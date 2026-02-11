import { executeQuery, initializePool } from '../../src/lib/oracle';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkMigrations() {
    await initializePool();
    
    try {
        console.log("Checking schema_migrations table...");
        const result = await executeQuery(`SELECT * FROM schema_migrations ORDER BY version`);
        console.log("Applied Migrations:", result);
    } catch (e: any) {
        if (e.message.includes('ORA-00942')) {
            console.log("schema_migrations table does not exist.");
        } else {
            console.error("Error:", e);
        }
    }
}

checkMigrations();
