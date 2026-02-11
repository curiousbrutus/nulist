import { executeQuery, initializePool } from '../../src/lib/oracle';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkUser(email: string) {
    await initializePool();
    
    try {
        console.log(`Checking user '${email}'...`);
        const users = await executeQuery(`SELECT id, email, full_name, zimbra_sync_enabled FROM profiles WHERE email = :email`, { email });
        
        if (users.length === 0) {
            console.log("User not found.");
        } else {
            console.log("User Found:", users[0]);
        }
        
    } catch (e) {
        console.error("Error:", e);
    }
}

checkUser('eyyubguven@optimed.com.tr');
