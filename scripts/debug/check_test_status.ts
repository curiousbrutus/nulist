
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkStatus() {
    try {
        await getConnection()
        
        // Find the most recent inserted test task
        const tasks = await executeQuery(`SELECT id, title FROM tasks WHERE title LIKE 'Test Task from Queue%' ORDER BY created_at DESC FETCH NEXT 1 ROWS ONLY`);
        
        if (tasks.length > 0) {
            const taskId = tasks[0].ID || tasks[0].id;
            console.log("Checking Task:", taskId);
            
            const assignee = await executeQuery(`SELECT user_id, zimbra_task_id FROM task_assignees WHERE task_id = :tid`, { tid: taskId });
            console.log("Assignee Record:", assignee);
            
            const queue = await executeQuery(`SELECT status, error_message FROM sync_queue WHERE task_id = :tid`, { tid: taskId });
            console.log("Queue Record:", queue);
        } else {
            console.log("No test task found");
        }

    } catch(e) { 
        console.error(e) 
    } finally {
        await closePool()
    }
}

checkStatus()
