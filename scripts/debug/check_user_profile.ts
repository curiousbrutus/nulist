
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkUserProfile() {
    try {
        await getConnection()
        console.log("Checking user profile...");
        
        const rows = await executeQuery(
            `SELECT id, email, zimbra_sync_enabled 
             FROM profiles 
             WHERE email = 'metehanceylan@optimed.com.tr'`
        );
        
        // Use Type Assertion or check if rows is array
        if (rows && rows.length > 0) {
            const user = rows[0] as any;
            console.log(`User: ${user.email}`);
            console.log(`Zimbra Sync Enabled: ${user.zimbra_sync_enabled}`);
            // Check type of zimbra_sync_enabled
            console.log(`Type: ${typeof user.zimbra_sync_enabled}`);
        } else {
            console.log("User not found.");
        }
        
    } catch(e) { 
        console.error("❌ Error:", e) 
    } finally {
        await closePool()
    }
}

checkUserProfile()
