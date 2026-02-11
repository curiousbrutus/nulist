
import { getConnection, closePool, executeQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testBindsPositional() {
    try {
        await getConnection()
        
        const taskId = 'TEST-TASK-ID'
        const userId = 'TEST-USER-ID'
        
        const permissionSql = `
            SELECT 1 as "access" FROM dual 
            WHERE EXISTS (
                 SELECT 1 FROM task_assignees WHERE task_id = :1 AND user_id = :2
            ) OR EXISTS (
                 SELECT 1 FROM tasks WHERE id = :3 AND created_by = :4
            ) OR EXISTS (
                 SELECT 1 FROM tasks t
                 JOIN lists l ON t.list_id = l.id
                 JOIN folder_members fm ON l.folder_id = fm.folder_id
                 WHERE t.id = :5 AND fm.user_id = :6
            ) OR EXISTS (
                 SELECT 1 FROM tasks t
                 JOIN lists l ON t.list_id = l.id
                 JOIN folders f ON l.folder_id = f.id
                 WHERE t.id = :7 AND f.user_id = :8
            ) OR EXISTS (
                 SELECT 1 FROM profiles WHERE id = :9 AND role IN ('admin', 'superadmin')
            )
        `

        console.log("Testing Positional Binds...")
        try {
            await executeQuery(permissionSql, [taskId, userId, taskId, userId, taskId, userId, taskId, userId, userId])
            console.log("Positional binds SUCCESS")
        } catch(e) {
            console.error("Positional binds FAILED:", e)
        }
        
    } catch(e) { 
        console.error(e) 
    } finally {
        await closePool()
    }
}

testBindsPositional()
