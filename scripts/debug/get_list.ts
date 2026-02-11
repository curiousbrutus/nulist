
import { getConnection, closePool } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function getList() {
    try {
        const conn = await getConnection()
        const result = await conn.execute(`SELECT id FROM lists WHERE ROWNUM <= 1`)
        if (result.rows && result.rows.length > 0) {
            console.log("LIST_ID:", result.rows[0][0] || result.rows[0].ID)
        } else {
            console.log("No lists found.")
        }
    } catch(e) { console.error(e) } finally { await closePool() }
}
getList()
