import { initializePool, executeQuery } from '../src/lib/oracle';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkProfiles() {
  try {
    await initializePool();
    
    const emails = [
      'user1@example.com',
      'user2@example.com',
      'user3@example.com',
      'user4@example.com'
    ];

    const sql = `
       SELECT id, email, full_name
       FROM profiles
       WHERE email IN (${emails.map(e => `'${e}'`).join(',')})
    `;

    const result = await executeQuery(sql);
    console.log('Profiles found:', result);

  } catch (error) {
    console.error('Error:', error);
  } finally {
      process.exit(0);
  }
}

checkProfiles();