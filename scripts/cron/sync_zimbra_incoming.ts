// Cron script to poll Zimbra for task updates (Reverse Sync)
// Usage: tsx scripts/cron/sync_zimbra_incoming.ts

import { getConnection, closePool } from '../../src/lib/oracle'
import { getZimbraTasksJSON } from '../../src/lib/zimbra-sync'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
    console.log('🔄 Starting Zimbra Incoming Sync...')
    let conn;

    try {
        conn = await getConnection()
        
        // 1. Get all users who might have Zimbra sync enabled
        // Checking for email existence. Could add checks for 'zimbra_sync_enabled' flag if it exists.
        const usersResult = await conn.execute(
            `SELECT id, email FROM profiles WHERE email IS NOT NULL AND zimbra_sync_enabled = 1`
        )
        const users = usersResult.rows || []
        console.log(`found ${users.length} users to check.`)

        for (const user of users) {
             const userId = user[0] || user.ID
             const userEmail = user[1] || user.EMAIL
             
             if (!userEmail) continue;

             try {
                // 2. Access Zimbra tasks
                // console.log(`Checking ${userEmail}...`)
                const start = Date.now();
                const zTasks = await getZimbraTasksJSON(userEmail)
                
                if (!zTasks || zTasks.length === 0) continue;

                // Index Zimbra tasks by ID for fast lookup
                // We use both ID (int) and UID (uuid) because we might have stored either
                const zTaskMap = new Map<string, any>()
                zTasks.forEach(t => {
                    if (t.id) zTaskMap.set(String(t.id), t)
                    // Also support UID if available (CalDAV created tasks use UID in our DB)
                    // Zimbra JSON might return 'inv' array or root props. 
                    // Usually 'uid' or 'inv[0].uid'. Let's check root 'uid' and 'im' (item ID)
                    if (t.uid) zTaskMap.set(t.uid, t)
                    // Sometimes ID is in "inv" array
                    if (t.inv && t.inv[0] && t.inv[0].uid) zTaskMap.set(t.inv[0].uid, t)
                })

                // 3. Get local tasks with Zimbra ID mappings
                const dbTasksResult = await conn.execute(
                    `SELECT task_id, zimbra_task_id, is_completed 
                     FROM task_assignees 
                     WHERE user_id = :uid AND zimbra_task_id IS NOT NULL`,
                    { uid: userId }
                )
                
                const dbTasks = dbTasksResult.rows || []
                let updatedCount = 0

                for (const dbTask of dbTasks) {
                    const taskId = dbTask[0] || dbTask.TASK_ID
                    const zId = dbTask[1] || dbTask.ZIMBRA_TASK_ID
                    const isCompleted = (dbTask[2] === 1 || dbTask.IS_COMPLETED === 1)

                    const zTask = zTaskMap.get(String(zId))
                    if (zTask) {
                        // Map status
                        // Zimbra: COMP, DEFER, INPR, WAITING, ...
                        // If COMP -> Completed (1)
                        // If anything else -> Not completed (0) - assuming simple toggle
                        const zIsCompleted = (zTask.status === 'COMP')

                        if (zIsCompleted !== isCompleted && zTask.status !== undefined) {
                            // Update local DB
                            await conn.execute(
                                `UPDATE task_assignees 
                                 SET is_completed = :st 
                                 WHERE task_id = :tid AND user_id = :uid`,
                                { 
                                    st: zIsCompleted ? 1 : 0, 
                                    tid: taskId, 
                                    uid: userId 
                                },
                                { autoCommit: true } // Commit each change to be safe/incremental
                            )
                            updatedCount++
                        }
                    }
                }

                if (updatedCount > 0) {
                    console.log(`✅ Synced ${userEmail}: Updated ${updatedCount} tasks.`)
                } else {
                    // console.log(`✓ Synced ${userEmail}: No changes.`)
                }

             } catch (err) {
                 console.error(`❌ Error syncing user ${userEmail}:`, err)
             }
        }
        
    } catch (err) {
        console.error('Fatal error in sync script:', err)
    } finally {
        if (conn) {
            try { await conn.close() } catch(e) {}
        }
        await closePool()
        console.log('🏁 Sync finished.')
        process.exit(0)
    }
}

main()
