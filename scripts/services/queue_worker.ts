import { executeQuery, executeNonQuery, initializePool } from '../../src/lib/oracle';
import { createZimbraTask, updateZimbraTask, deleteZimbraTask } from '../../src/lib/zimbra-sync';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Job processing loop
async function startWorker() {
    await initializePool();
    console.log("🚀 Zimbra Sync Worker Started");

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
    // Oracle 12c+ supports FETCH FIRST, but strictly standard way:
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
    
    console.log(`Processing Job ${jobId}: ${job.ACTION_TYPE || job.action_type} for ${job.USER_EMAIL || job.user_email}`);

    // 2. Mark as PROCESSING
    await executeNonQuery(
        `UPDATE sync_queue SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
        { id: jobId }
    );

    try {
        const payload = JSON.parse((job.PAYLOAD || job.payload || '{}').toString());
        const userEmail = job.USER_EMAIL || job.user_email;
        const taskId = job.TASK_ID || job.task_id;
        
        let result: any = { success: false, error: 'Unknown action' };

        // 3. Execute Action
        if ((job.ACTION_TYPE || job.action_type) === 'CREATE') {
            result = await createZimbraTask(userEmail, {
                title: payload.title,
                notes: payload.notes,
                due_date: payload.due_date,
                priority: payload.priority,
                status: payload.status,
                is_completed: payload.is_completed
            });

            if (result.success && result.uid) {
                // Save Zimbra ID to task_assignees
                // We need user_id for this
                await executeNonQuery(`
                    UPDATE task_assignees ta
                    SET zimbra_task_id = :zimbra_id
                    WHERE task_id = :task_id 
                    AND user_id = (SELECT id FROM profiles WHERE email = :email)
                `, {
                    zimbra_id: result.uid,
                    task_id: taskId,
                    email: userEmail
                });
            }

        } else if ((job.ACTION_TYPE || job.action_type) === 'UPDATE') {
            // Need the current zimbra_task_id to update
            const assignee = await executeQuery(`
                SELECT ta.zimbra_task_id 
                FROM task_assignees ta
                JOIN profiles p ON ta.user_id = p.id
                WHERE ta.task_id = :task_id AND p.email = :email
            `, { task_id: taskId, email: userEmail });

            if (assignee && assignee.length > 0 && (assignee[0].ZIMBRA_TASK_ID || assignee[0].zimbra_task_id)) {
                const zimbraId = assignee[0].ZIMBRA_TASK_ID || assignee[0].zimbra_task_id;
                result = await updateZimbraTask(userEmail, zimbraId, {
                    title: payload.title,
                    notes: payload.notes,
                    due_date: payload.due_date,
                    priority: payload.priority,
                    status: payload.status,
                    is_completed: payload.is_completed
                });
            } else {
                // If no Zimbra ID, maybe upgrade to CREATE?
                // For now, treat as failed or skip
                result = { success: false, error: 'Cannot update: No linked Zimbra ID found' };
            }

        } else if ((job.ACTION_TYPE || job.action_type) === 'DELETE') {
             // Fetch Zimbra ID if payload doesn't have it (it usually shouldn't, we look it up usually, 
             // but for DELETE we might have cleared the DB row already?)
             // Usually DELETE events should be queued BEFORE DB delete or payload should contain the ID.
             // Let's assume payload *might* have it, or we look it up.
             // If DB row is gone, we can't look it up. 
             // Ideally, when queueing DELETE, we include zimbra_task_id in payload.
             
             let zimbraId = payload.zimbra_task_id;
             if (!zimbraId) {
                 // Try DB lookup (might fail if row deleted)
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
                 result = await deleteZimbraTask(userEmail, zimbraId);
             } else {
                 result = { success: true }; // Already gone or unknown, treat as success
             }
        }

        // 4. Handle Result
        if (result.success) {
            await executeNonQuery(
                `UPDATE sync_queue SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
                { id: jobId }
            );
            console.log(`✓ Job ${jobId} Completed`);
        } else {
            throw new Error(result.error);
        }

    } catch (err: any) {
        console.error(`✗ Job ${jobId} Failed:`, err.message);
        
        // Retry logic
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
        }
    }

    return true; // We processed a job
}

// Start if run directly
if (require.main === module) {
    startWorker();
}
