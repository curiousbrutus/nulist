import { initializePool, executeQuery } from '../src/lib/oracle';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkCompletedJobs() {
  try {
    await initializePool();
    
    const sql = `
       SELECT DISTINCT q.user_email
       FROM sync_queue q
       WHERE q.status = 'COMPLETED'
    `;

    const result = await executeQuery(sql);

    console.log('✅ Users with successful syncs:');
    if (result && result.length > 0) {
      result.forEach((row: any) => {
        console.log(`- ${row.user_email || row.USER_EMAIL}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
      process.exit(0);
  }
}

checkCompletedJobs();