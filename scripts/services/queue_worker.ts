import { executeQuery, executeNonQuery, initializePool } from '../../src/lib/oracle';
import { createZimbraTaskViaAdminAPI, updateZimbraTaskViaAdminAPI, deleteZimbraTaskViaAdminAPI } from '../../src/lib/zimbra-sync';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Job processing loop
async function startWorker() {
    await initializePool();
    console.log("Zimbra Sync Worker Started");

    while (true) {
        try {
            const hasWork = await processNextJob();
            if (!hasWork) {
                // Wait 5 seconds before next check if queue is empty
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (e) {
            console.error("Worker Global Error:", e);
            // Wait 10s on error
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

async function processNextJob() {
    // 1. Fetch next PENDING job (FIFO)
    const jobs = await executeQuery(`
        SELECT id, task_id, user_email, action_type, payload, retry_count
        FROM sync_queue
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        FETCH FIRST 1 ROWS ONLY
    `);

    if (!jobs || jobs.length === 0) return false;

    const job = jobs[0];
    const jobId = job.ID || job.id;
    const actionType = job.ACTION_TYPE || job.action_type;
    const userEmail = job.USER_EMAIL || job.user_email;
    const taskId = job.TASK_ID || job.task_id;

    console.log(`Processing Job ${jobId}: ${actionType} for ${userEmail}`);

    // 2. Mark as PROCESSING
    await executeNonQuery(
        `UPDATE sync_queue SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
        { id: jobId }
    );

    try {
        const payload = JSON.parse((job.PAYLOAD || job.payload || '{}').toString());

        let result: any = { success: false, error: 'Unknown action' };

        // 3. Execute Action - all via Admin SOAP API (no CalDAV needed)
        if (actionType === 'CREATE') {
            result = await createZimbraTaskViaAdminAPI(userEmail, {
                title: payload.title,
                notes: payload.notes,
                due_date: payload.due_date,
                priority: payload.priority,
                status: payload.status
            });

            // Save Zimbra calItemId to task_assignees for future updates/deletes
            const zimbraId = result.taskId || result.uid;
            if (result.success && zimbraId) {
                await executeNonQuery(`
                    UPDATE task_assignees ta
                    SET zimbra_task_id = :zimbra_id
                    WHERE task_id = :task_id
                    AND user_id = (SELECT id FROM profiles WHERE email = :email)
                `, {
                    zimbra_id: zimbraId,
                    task_id: taskId,
                    email: userEmail
                });
                console.log(`  Saved zimbra_task_id: ${zimbraId}`);
            }

        } else if (actionType === 'UPDATE') {
            // Get the stored Zimbra calItemId
            const assignee = await executeQuery(`
                SELECT ta.zimbra_task_id
                FROM task_assignees ta
                JOIN profiles p ON ta.user_id = p.id
                WHERE ta.task_id = :task_id AND p.email = :email
            `, { task_id: taskId, email: userEmail });

            if (assignee && assignee.length > 0 && (assignee[0].ZIMBRA_TASK_ID || assignee[0].zimbra_task_id)) {
                const zimbraId = assignee[0].ZIMBRA_TASK_ID || assignee[0].zimbra_task_id;
                result = await updateZimbraTaskViaAdminAPI(userEmail, zimbraId, {
                    title: payload.title,
                    notes: payload.notes,
                    due_date: payload.due_date,
                    priority: payload.priority,
                    status: payload.status,
                    is_completed: payload.is_completed
                });
                // Update stores new calItemId after delete+recreate
                if (result.success && result.newTaskId) {
                    await executeNonQuery(`
                        UPDATE task_assignees ta
                        SET zimbra_task_id = :zimbra_id
                        WHERE task_id = :task_id
                        AND user_id = (SELECT id FROM profiles WHERE email = :email)
                    `, {
                        zimbra_id: result.newTaskId,
                        task_id: taskId,
                        email: userEmail
                    });
                    console.log(`  Updated zimbra_task_id: ${zimbraId} -> ${result.newTaskId}`);
                }
            } else {
                // No Zimbra ID stored - create it instead
                console.log(`  No Zimbra ID found for update, creating instead...`);
                result = await createZimbraTaskViaAdminAPI(userEmail, {
                    title: payload.title,
                    notes: payload.notes,
                    due_date: payload.due_date,
                    priority: payload.priority,
                    status: payload.status
                });
                // Save the new ID
                const zimbraId = result.taskId || result.uid;
                if (result.success && zimbraId) {
                    await executeNonQuery(`
                        UPDATE task_assignees ta
                        SET zimbra_task_id = :zimbra_id
                        WHERE task_id = :task_id
                        AND user_id = (SELECT id FROM profiles WHERE email = :email)
                    `, {
                        zimbra_id: zimbraId,
                        task_id: taskId,
                        email: userEmail
                    });
                }
            }

        } else if (actionType === 'DELETE') {
            // Get Zimbra ID from payload or DB
            let zimbraId = payload.zimbra_task_id;
            if (!zimbraId) {
                const assignee = await executeQuery(`
                    SELECT ta.zimbra_task_id
                    FROM task_assignees ta
                    JOIN profiles p ON ta.user_id = p.id
                    WHERE ta.task_id = :task_id AND p.email = :email
                `, { task_id: taskId, email: userEmail });
                if (assignee && assignee.length > 0) {
                    zimbraId = assignee[0].ZIMBRA_TASK_ID || assignee[0].zimbra_task_id;
                }
            }

            if (zimbraId) {
                result = await deleteZimbraTaskViaAdminAPI(userEmail, zimbraId);
            } else {
                result = { success: true }; // Already gone, treat as success
            }
        }

        // 4. Handle Result
        if (result.success) {
            await executeNonQuery(
                `UPDATE sync_queue SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
                { id: jobId }
            );
            console.log(`  -> Job ${jobId} COMPLETED`);
        } else {
            throw new Error(result.error);
        }

    } catch (err: any) {
        console.error(`  -> Job ${jobId} FAILED:`, err.message);

        // Retry logic - max 3 retries
        const currentRetry = (job.RETRY_COUNT || job.retry_count || 0);
        if (currentRetry < 3) {
            await executeNonQuery(
                `UPDATE sync_queue SET status = 'PENDING', retry_count = :rc, error_message = :msg, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
                { id: jobId, rc: currentRetry + 1, msg: err.message.substring(0, 4000) }
            );
        } else {
            await executeNonQuery(
                `UPDATE sync_queue SET status = 'FAILED', error_message = :msg, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
                { id: jobId, msg: err.message.substring(0, 4000) }
            );
            console.log(`  -> Job ${jobId} permanently FAILED after ${currentRetry + 1} attempts`);
        }
    }

    return true; // We processed a job
}

// Start if run directly
if (require.main === module) {
    startWorker();
}
