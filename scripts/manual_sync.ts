
import { executeQuery, executeNonQuery, initializePool } from '../src/lib/oracle';
import { createZimbraTask, updateZimbraTask, deleteZimbraTask } from '../src/lib/zimbra-sync';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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
        
        // Skip check: specific users known to fail or invalid
        if (!userEmail || userEmail.includes('???')) { 
             throw new Error('Invalid email');
        }

        let result: any = { success: false, error: 'Unknown action' };

        // 3. Execute Action
        if ((job.ACTION_TYPE || job.action_type) === 'CREATE') {
            result = await createZimbraTask(userEmail, {
                title: payload.title,
                notes: payload.notes,
                due_date: payload.due_date,
                priority: payload.priority
            });

            if (result.success && result.taskId) {
                // Save Zimbra ID to task_assignees
                await executeNonQuery(`
                    UPDATE task_assignees ta
                    SET zimbra_task_id = :zimbra_id
                    WHERE task_id = :task_id 
                    AND user_id = (SELECT id FROM profiles WHERE email = :email)
                `, {
                    zimbra_id: result.taskId,
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
                    is_completed: payload.is_completed
                });
            } else {
                result = { success: false, error: 'Cannot update: No linked Zimbra ID found' };
            }

        } else if ((job.ACTION_TYPE || job.action_type) === 'DELETE') {
             // ... handling delete ...
             const assignee = await executeQuery(`
                SELECT ta.zimbra_task_id 
                FROM task_assignees ta
                JOIN profiles p ON ta.user_id = p.id
                WHERE ta.task_id = :task_id AND p.email = :email
            `, { task_id: taskId, email: userEmail });
            
             let zimbraId = payload.zimbra_task_id;
             if (!zimbraId && assignee.length > 0) {
                 zimbraId = assignee[0].ZIMBRA_TASK_ID || assignee[0].zimbra_task_id;
             }

             if (zimbraId) {
                 result = await deleteZimbraTask(userEmail, zimbraId);
             } else {
                 result = { success: true };
             }
        }

        // 4. Handle Result
        if (result.success) {
            await executeNonQuery(
                `UPDATE sync_queue SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
                { id: jobId }
            );
            console.log(`✓ Job Completed. Zimbra ID: ${result.taskId || 'N/A'}`);
        } else {
            throw new Error(result.error);
        }

    } catch (err: any) {
        console.error(`✗ Job Failed:`, err.message);
        
        await executeNonQuery(
            `UPDATE sync_queue SET status = 'FAILED', error_message = :msg, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
            { id: jobId, msg: err.message.substring(0, 4000) }
        );
    }

    return true;
}

async function run() {
    // Prevent PM2 conflicts roughly?
    // Actually, running parallel is risky if they pick same row.
    // Assuming processNextJob SELECT ... FOR UPDATE or just hoping small delay works with fetch first.
    // Oracle Fetch First isn't locking.
    console.log("🚀 Starting Manual Sync Processing...");
    
    await initializePool();
    
    let count = 0;
    while (true) {
        const processed = await processNextJob();
        if (!processed) {
            break;
        }
        count++;
        // Small delay to be nice
        await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`✅ Sync Complete. Processed ${count} jobs.`);
    process.exit(0);
}

run();
