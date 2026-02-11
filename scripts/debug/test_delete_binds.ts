
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testDeleteBinds() {
    try {
        await getConnection()
        
        const permissionSql = `SELECT 1 as "access" FROM dual 
                 WHERE EXISTS (
                     SELECT 1 FROM tasks WHERE id = :1 AND created_by = :2
                 ) OR EXISTS (
                     SELECT 1 FROM tasks t
                     JOIN lists l ON t.list_id = l.id
                     JOIN folders f ON l.folder_id = f.id
                     WHERE t.id = :1 AND f.user_id = :2
                 ) OR EXISTS (
                     SELECT 1 FROM profiles WHERE id = :2 AND role IN ('admin', 'superadmin')
                 )`

        console.log("Testing DELETE Positional Binds...")
        try {
            // This mirrors the code in DELETE handler
            await executeQuery(permissionSql, ['TASK-ID', 'USER-ID'])
            console.log("DELETE Positional binds SUCCESS")
        } catch(e) {
            console.error("DELETE Positional binds FAILED:", e)
        }
        
    } catch(e) { 
        console.error(e) 
    } finally {
        await closePool()
    }
}

testDeleteBinds()
