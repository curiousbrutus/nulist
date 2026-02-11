
import { getConnection, closePool, executeNonQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function enableZimbraSync() {
    try {
        await getConnection()
        console.log("Enabling Zimbra Sync for metehanceylan@optimed.com.tr...");
        
        await executeNonQuery(
            `UPDATE profiles SET zimbra_sync_enabled = 1 WHERE email = 'metehanceylan@optimed.com.tr'`
        );
        
        console.log("✅ Updated successfully.");
        
    } catch(e) { 
        console.error("❌ Error:", e) 
    } finally {
        await closePool()
    }
}

enableZimbraSync()
