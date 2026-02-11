import { executeQuery, initializePool } from '../../src/lib/oracle';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkTask() {
    await initializePool();
    
    try {
        console.log("Searching for task 'deneme0502'...");
        const tasks = await executeQuery(`SELECT id, title, created_at FROM tasks WHERE title = 'deneme0502'`);
        
        if (tasks.length === 0) {
            console.log("Task 'deneme0502' not found.");
            return;
        }

        const task = tasks[0];
        console.log("Task Found:", task);
        
        console.log("Checking assignees...");
        const assignees = await executeQuery(`
            SELECT ta.user_id, p.full_name, p.email, ta.zimbra_task_id 
            FROM task_assignees ta 
            JOIN profiles p ON ta.user_id = p.id 
            WHERE ta.task_id = :id
        `, { id: task.ID || task.id });
        
        console.log("Assignees:", assignees);
        
    } catch (e) {
        console.error("Error:", e);
    }
}

checkTask();
