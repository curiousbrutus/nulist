
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkTask() {
    try {
        await getConnection()
        console.log("Checking tasks table...");
        
        const rows = await executeQuery(
            `SELECT title, priority, due_date, status 
             FROM tasks 
             WHERE title = 'püskevit' 
             ORDER BY created_at DESC FETCH FIRST 1 ROWS ONLY`
        );
        
        console.table(rows);
        
    } catch(e) { 
        console.error("❌ Error:", e) 
    } finally {
        await closePool()
    }
}

checkTask()
