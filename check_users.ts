
import { executeQuery, initializePool } from './src/lib/oracle';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listUsers() {
    await initializePool();
    const users = await executeQuery('SELECT id, full_name, email FROM profiles');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
}

listUsers();
