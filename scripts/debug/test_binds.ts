
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testBinds() {
    try {
        await getConnection()
        
        const taskId = 'TEST-TASK-ID'
        const userId = 'TEST-USER-ID'
        
        const permissionSql = `
            SELECT 1 as "access" FROM dual 
            WHERE EXISTS (
                 SELECT 1 FROM task_assignees WHERE task_id = :task_id AND user_id = :user_id
            ) OR EXISTS (
                 SELECT 1 FROM tasks WHERE id = :task_id AND created_by = :user_id
            ) OR EXISTS (
                 SELECT 1 FROM tasks t
                 JOIN lists l ON t.list_id = l.id
                 JOIN folder_members fm ON l.folder_id = fm.folder_id
                 WHERE t.id = :task_id AND fm.user_id = :user_id
            ) OR EXISTS (
                 SELECT 1 FROM tasks t
                 JOIN lists l ON t.list_id = l.id
                 JOIN folders f ON l.folder_id = f.id
                 WHERE t.id = :task_id AND f.user_id = :user_id
            ) OR EXISTS (
                 SELECT 1 FROM profiles WHERE id = :user_id AND role IN ('admin', 'superadmin')
            )
        `

        console.log("Testing Named Binds...")
        try {
            await executeQuery(permissionSql, { task_id: taskId, user_id: userId })
            console.log("Named binds SUCCESS")
        } catch(e) {
            console.error("Named binds FAILED:", e)
        }
        
    } catch(e) { 
        console.error(e) 
    } finally {
        await closePool()
    }
}

testBinds()
