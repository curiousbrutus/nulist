
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkQueue() {
    try {
        await getConnection()
        console.log("Checking sync_queue...");
        
        const rows = await executeQuery(
            `SELECT id, action_type, status, error_message, created_at, updated_at 
             FROM sync_queue 
             WHERE user_email = 'metehanceylan@optimed.com.tr' 
             ORDER BY created_at DESC FETCH FIRST 5 ROWS ONLY`
        );
        
        console.table(rows);
        
    } catch(e) { 
        console.error("❌ Error:", e) 
    } finally {
        await closePool()
    }
}

checkQueue()
