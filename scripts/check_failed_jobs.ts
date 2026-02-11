import { initializePool, executeQuery } from '../src/lib/oracle';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkFailedJobs() {
  try {
    await initializePool();
    
    // Get failed jobs with details
    // We select specific columns
    const sql = `
       SELECT q.id, q.task_id, q.action_type, q.status, q.error_message, q.retry_count,
              t.title, t.description
       FROM sync_queue q
       LEFT JOIN tasks t ON q.task_id = t.id
       WHERE q.status = 'FAILED'
       ORDER BY q.created_at DESC
    `;

    const result = await executeQuery(sql);

    console.log('❌ Failed Jobs Details:');
    if (result && result.length > 0) {
      result.forEach((row: any) => {
        console.log(row);
        console.log('----------------------------------------');
        // Oracle usually returns UPPERCASE column names
        console.log(`Job ID: ${row.ID || row[0]}, Task ID: ${row.TASK_ID || row[1]}`);
        console.log(`Operation: ${row.ACTION_TYPE || row[2]}`);
        console.log(`Task: ${row.TITLE || row[6]}`);
        console.log(`Error: ${row.ERROR_MESSAGE || row[4]}`); 
        console.log(`Retry Count: ${row.RETRY_COUNT || row[5]}`);
      });
    } else {
      console.log('No failed jobs found (or query returned empty).');
    }

  } catch (error) {
    console.error('Error checking failed jobs:', error);
  } finally {
      // In a script we might want to exit, but let's just let node finish
      process.exit(0);
  }
}

checkFailedJobs();
