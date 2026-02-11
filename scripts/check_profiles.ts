import { initializePool, executeQuery } from '../src/lib/oracle';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkProfiles() {
  try {
    await initializePool();
    
    const emails = [
      'merveagdagli@optimed.com.tr',
      'nagihanavci@optimed.com.tr',
      'elcinesenesiyok@optimed.com.tr',
      'arzucerentuna@optimed.com.tr'
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