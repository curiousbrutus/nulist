
import { getConnection, closePool } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkUsers() {
    try {
        const conn = await getConnection()
        const result = await conn.execute(`SELECT email, id, zimbra_sync_enabled FROM profiles WHERE email IS NOT NULL AND ROWNUM <= 5`)
        console.log("Users available:", result.rows)
        await conn.close()
    } catch(e) { 
        console.error(e) 
    } finally {
        await closePool()
    }
}

checkUsers()
