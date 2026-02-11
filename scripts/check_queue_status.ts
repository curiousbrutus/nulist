
import { executeQuery, initializePool } from '../src/lib/oracle';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkQueue() {
    await initializePool();
    const result = await executeQuery(`SELECT status, count(*) as cnt FROM sync_queue GROUP BY status`);
    console.log('Queue Status:', result);
    process.exit(0);
}

checkQueue();
