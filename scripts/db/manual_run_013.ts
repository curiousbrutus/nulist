import { executeNonQuery, initializePool } from '../../src/lib/oracle';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration013() {
    await initializePool();
    
    const sqlPath = path.join(process.cwd(), 'migrations', '013_create_sync_queue.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Running migration 013...");
    
    try {
        // The file is a PL/SQL block, so we can execute it directly
        // Note: We might need to remove the trailing slash if present
        const cleanSql = sql.trim().replace(/\/$/, '');
        
        await executeNonQuery(cleanSql);
        console.log("Migration 013 SUCCESS");
        
        // Optionally mark it in schema_migrations if we want to sync up later
        // await executeNonQuery(`INSERT INTO schema_migrations (version, name) VALUES (13, 'create sync queue')`);
        
    } catch (e) {
        console.error("Migration 013 FAILED:", e);
    }
}

runMigration013();
