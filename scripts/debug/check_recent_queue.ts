
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkRecentQueueItems() {
    try {
        await getConnection()
        console.log("Checking last 10 items in sync_queue...");
        
        // Fetch last 10 items to see if UI generated ones are there
        const rows = await executeQuery(
            `SELECT id, action_type, status, error_message, created_at, payload 
             FROM sync_queue 
             ORDER BY created_at DESC FETCH FIRST 10 ROWS ONLY`
        );
        
        if (rows.length === 0) {
            console.log("No items found in sync_queue.");
        } else {
            // Log details to see source of data
            rows.forEach((row: any) => {
                console.log(`[${row.created_at}] Type: ${row.action_type}, Status: ${row.status}`);
                console.log(`Error: ${row.error_message}`);
                try {
                    const payload = JSON.parse(row.payload);
                    console.log(`Payload Title: ${payload.title}`);
                } catch (e) {
                    console.log(`Payload (raw): ${row.payload}`);
                }
                console.log('---');
            });
        }
        
    } catch(e) { 
        console.error("❌ Error:", e) 
    } finally {
        await closePool()
    }
}

checkRecentQueueItems()
