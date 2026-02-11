
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkZimbraId() {
    try {
        await getConnection()
        console.log("Checking Zimbra ID for 'püskevit'...");
        
        const rows = await executeQuery(
            `SELECT t.title, ta.zimbra_task_id 
             FROM tasks t
             JOIN task_assignees ta ON t.id = ta.task_id
             JOIN profiles p ON ta.user_id = p.id
             WHERE t.title = 'püskevit' AND p.email = 'metehanceylan@optimed.com.tr'`
        );
        
        console.table(rows);
        
    } catch(e) { 
        console.error("❌ Error:", e) 
    } finally {
        await closePool()
    }
}

checkZimbraId()
