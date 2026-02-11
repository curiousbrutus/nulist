
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkUserAndQueue() {
    try {
        await getConnection()
        
        console.log("--- Checking User Settings ---")
        const user = await executeQuery(`SELECT email, zimbra_sync_enabled FROM profiles WHERE email LIKE 'eyyubguven%'`);
        console.log(user);

        console.log("--- Checking Recent Queue Items (Last 5) ---")
        const queue = await executeQuery(`SELECT created_at, action_type, status, error_message, user_email FROM sync_queue ORDER BY created_at DESC FETCH NEXT 5 ROWS ONLY`);
        console.log(queue);

    } catch(e) { 
        console.error(e) 
    } finally {
        await closePool()
    }
}

checkUserAndQueue()
