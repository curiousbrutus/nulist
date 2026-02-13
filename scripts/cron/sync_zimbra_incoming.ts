// Persistent service to poll Zimbra for task updates (Bidirectional Sync)
// Runs as PM2 process: pm2 start scripts/cron/sync_zimbra_incoming.ts --name zimbra-incoming-sync --interpreter tsx

import { initializePool, executeQuery, executeNonQuery } from '../../src/lib/oracle'
import { getZimbraTasksJSON, ZIMBRA_TO_STATUS } from '../../src/lib/zimbra-sync'
import dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const POLL_INTERVAL = 120000 // 2 minutes

// Zimbra priority number -> NeoList priority string
const ZIMBRA_PRIORITY_MAP: Record<number, string> = {
    1: 'Acil',
    2: 'Yüksek',
    3: 'Yüksek',
    4: 'Orta',
    5: 'Orta',
    6: 'Orta',
    7: 'Düşük',
    8: 'Düşük',
    9: 'Düşük'
}

async function ensureDefaultFolder(userId: string): Promise<string> {
    // Check if user already has a "Zimbra Görevleri" folder
    const existing = await executeQuery(
        `SELECT id FROM folders WHERE user_id = :userid AND title = 'Zimbra Görevleri'`,
        { userid: userId }
    )

    if (existing && existing.length > 0) {
        return existing[0].ID || existing[0].id
    }

    // Create default folder
    const folderId = crypto.randomUUID()
    await executeNonQuery(
        `INSERT INTO folders (id, title, user_id) VALUES (:id, :title, :userid)`,
        { id: folderId, title: 'Zimbra Görevleri', userid: userId }
    )

    return folderId
}

async function ensureDefaultList(folderId: string): Promise<string> {
    // Check if folder already has a "Gelen Görevler" list
    const existing = await executeQuery(
        `SELECT id FROM lists WHERE folder_id = :fid AND title = 'Gelen Görevler'`,
        { fid: folderId }
    )

    if (existing && existing.length > 0) {
        return existing[0].ID || existing[0].id
    }

    // Create default list
    const listId = crypto.randomUUID()
    await executeNonQuery(
        `INSERT INTO lists (id, folder_id, title, type) VALUES (:id, :fid, :title, 'list')`,
        { id: listId, fid: folderId, title: 'Gelen Görevler' }
    )

    return listId
}

function extractTaskData(zTask: any): {
    name: string
    description: string
    dueDate: string | null
    status: string
    priority: string
    zimbraId: string
    isCompleted: boolean
} {
    // Zimbra JSON REST format: task data is nested in inv[0].comp[0]
    const comp = zTask.inv?.[0]?.comp?.[0]
    const name = comp?.name || zTask.name || zTask.su || zTask.subject || 'Untitled'

    // Description: comp.desc is an array [{_content: "..."}], also check comp.fr (fragment)
    const description = comp?.desc?.[0]?._content || comp?.fr || zTask.fr || zTask.desc || ''

    // Due date - in comp.e[0].d (YYYYMMDD format) or comp.s[0].d (start date)
    let dueDate: string | null = null
    const dueDateStr = comp?.e?.[0]?.d || comp?.s?.[0]?.d
    if (dueDateStr && typeof dueDateStr === 'string' && dueDateStr.length >= 8) {
        dueDate = `${dueDateStr.slice(0, 4)}-${dueDateStr.slice(4, 6)}-${dueDateStr.slice(6, 8)}T00:00:00.000Z`
    } else if (zTask.e) {
        // Fallback: epoch milliseconds at top level
        dueDate = new Date(typeof zTask.e === 'number' ? zTask.e : parseInt(zTask.e)).toISOString()
    }

    // Status - from comp level
    const zStatus = comp?.status || zTask.status || 'NEED'
    const status = ZIMBRA_TO_STATUS[zStatus] || 'pending'
    const isCompleted = zStatus === 'COMP'

    // Priority - from comp level
    const zPriority = parseInt(comp?.priority || zTask.priority || '5')
    const priority = ZIMBRA_PRIORITY_MAP[zPriority] || 'Orta'

    // Zimbra ID (calItemId - numeric string like "2181")
    const zimbraId = String(zTask.id || '')

    return { name, description, dueDate, status, priority, zimbraId, isCompleted }
}

async function syncUserTasks(userId: string, userEmail: string) {
    try {
        const zTasks = await getZimbraTasksJSON(userEmail)
        if (!zTasks || zTasks.length === 0) return

        // Build Zimbra task lookup by multiple ID formats
        // REST API returns id (calItemId number) and uid (VTODO UUID)
        const zTaskMap = new Map<string, any>()
        for (const t of zTasks) {
            const calItemId = String(t.id || '')
            if (calItemId) zTaskMap.set(calItemId, t)
            if (t.uid) zTaskMap.set(t.uid, t)
            if (t.inv?.[0]?.uid) zTaskMap.set(t.inv[0].uid, t)
            if (t.inv?.[0]?.comp?.[0]?.uid) zTaskMap.set(t.inv[0].comp[0].uid, t)
        }

        // Get existing NeoList tasks with Zimbra IDs for this user
        const dbTasks = await executeQuery(
            `SELECT ta.task_id, ta.zimbra_task_id, ta.is_completed, t.status, t.title
             FROM task_assignees ta
             JOIN tasks t ON ta.task_id = t.id
             WHERE ta.user_id = :userid AND ta.zimbra_task_id IS NOT NULL`,
            { userid: userId }
        )

        // Track all Zimbra calItemIds that are already linked to DB tasks
        const linkedCalItemIds = new Set<string>()
        const linkedUids = new Set<string>()
        let statusUpdated = 0

        // Helper to find Zimbra task from stored ID (handles uuid:number, plain number, or VTODO UID)
        function findZimbraTask(storedId: string): any {
            // Try direct match
            let zTask = zTaskMap.get(storedId)
            if (zTask) return zTask

            // If stored ID is "uuid:number" format, extract the number part (calItemId)
            if (storedId.includes(':')) {
                const parts = storedId.split(':')
                const calItemId = parts[parts.length - 1]
                // calItemId might be "2472" or "2472-2471" (invId format)
                const numericPart = calItemId.split('-')[0]
                zTask = zTaskMap.get(numericPart)
                if (zTask) return zTask
            }

            return null
        }

        // Phase 1: Update existing task statuses from Zimbra
        for (const dbTask of dbTasks) {
            const taskId = dbTask.TASK_ID || dbTask.task_id
            const zId = String(dbTask.ZIMBRA_TASK_ID || dbTask.zimbra_task_id)
            const localCompleted = (dbTask.IS_COMPLETED === 1 || dbTask.is_completed === 1)
            const localStatus = dbTask.STATUS || dbTask.status || 'pending'

            const zTask = findZimbraTask(zId)
            if (zTask) {
                // Track the calItemId and uid as linked
                if (zTask.id) linkedCalItemIds.add(String(zTask.id))
                if (zTask.uid) linkedUids.add(zTask.uid)

                const { status: zNeoStatus, isCompleted: zIsCompleted } = extractTaskData(zTask)

                // Sync status if different
                if (zIsCompleted !== localCompleted || (zNeoStatus !== localStatus && zNeoStatus !== 'pending')) {
                    await executeNonQuery(
                        `UPDATE task_assignees SET is_completed = :ic WHERE task_id = :tid AND user_id = :userid`,
                        { ic: zIsCompleted ? 1 : 0, tid: taskId, userid: userId }
                    )

                    await executeNonQuery(
                        `UPDATE tasks SET status = :st, is_completed = :ic WHERE id = :tid`,
                        { st: zNeoStatus, ic: zIsCompleted ? 1 : 0, tid: taskId }
                    )

                    statusUpdated++
                    console.log(`    Status sync: "${dbTask.TITLE || dbTask.title}" ${localStatus} -> ${zNeoStatus}`)
                }
            } else {
                // Track the stored ID format for existing entries
                // This prevents re-importing tasks whose calItemId changed
                linkedCalItemIds.add(zId)
                if (zId.includes(':')) {
                    const numericPart = zId.split(':').pop()?.split('-')[0] || ''
                    if (numericPart) linkedCalItemIds.add(numericPart)
                }
            }
        }

        // Phase 2: Import NEW Zimbra tasks (not yet in NeoList)
        let imported = 0
        let defaultListId: string | null = null

        for (const zTask of zTasks) {
            const calItemId = String(zTask.id || '')
            const uid = zTask.uid || zTask.inv?.[0]?.uid || ''

            if (!calItemId) continue

            // Skip if already linked
            if (linkedCalItemIds.has(calItemId)) continue
            if (uid && linkedUids.has(uid)) continue

            // Check if this calItemId or uid already exists in DB (handles multiple ID formats)
            const alreadyExists = await executeQuery(
                `SELECT 1 FROM task_assignees
                 WHERE user_id = :userid
                 AND (zimbra_task_id = :zid OR zimbra_task_id LIKE :zidpat OR zimbra_task_id = :vtodouid)`,
                { userid: userId, zid: calItemId, zidpat: `%:${calItemId}`, vtodouid: uid || 'NONE' }
            )
            if (alreadyExists && alreadyExists.length > 0) continue

            // This is a new Zimbra task - import it
            const data = extractTaskData(zTask)

            // Lazy-create default folder/list
            if (!defaultListId) {
                const folderId = await ensureDefaultFolder(userId)
                defaultListId = await ensureDefaultList(folderId)
            }

            const newTaskId = crypto.randomUUID()

            // Create task in NeoList
            await executeNonQuery(
                `INSERT INTO tasks (id, list_id, title, notes, is_completed, priority, due_date, status, created_by)
                 VALUES (:id, :list_id, :title, :notes, :ic, :priority, :due_date, :status, :created_by)`,
                {
                    id: newTaskId,
                    list_id: defaultListId,
                    title: data.name,
                    notes: data.description || null,
                    ic: data.isCompleted ? 1 : 0,
                    priority: data.priority,
                    due_date: data.dueDate ? new Date(data.dueDate) : null,
                    status: data.status,
                    created_by: userId
                }
            )

            // Create task_assignee with calItemId as zimbra_task_id
            await executeNonQuery(
                `INSERT INTO task_assignees (task_id, user_id, is_completed, zimbra_task_id)
                 VALUES (:tid, :userid, :ic, :zid)`,
                {
                    tid: newTaskId,
                    userid: userId,
                    ic: data.isCompleted ? 1 : 0,
                    zid: calItemId
                }
            )

            imported++
            console.log(`    Imported: "${data.name}" (calItemId: ${calItemId})`)
        }

        if (statusUpdated > 0 || imported > 0) {
            console.log(`  ${userEmail}: ${statusUpdated} status updates, ${imported} new tasks imported`)
        }

    } catch (err) {
        console.error(`  Error syncing ${userEmail}:`, err)
    }
}

async function runSyncCycle() {
    try {
        const users = await executeQuery(
            `SELECT id, email FROM profiles WHERE email IS NOT NULL AND zimbra_sync_enabled = 1`
        )

        if (!users || users.length === 0) return

        console.log(`[Sync] Processing ${users.length} users...`)

        for (const user of users) {
            const userId = user.ID || user.id
            const userEmail = user.EMAIL || user.email
            if (!userEmail) continue

            await syncUserTasks(userId, userEmail)
        }

        console.log(`[Sync] Cycle complete.`)

        // Update last sync timestamp for all synced users
        await executeNonQuery(
            `UPDATE profiles SET zimbra_last_sync = CURRENT_TIMESTAMP WHERE zimbra_sync_enabled = 1`
        )

    } catch (err) {
        console.error('Sync cycle error:', err)
    }
}

async function startService() {
    await initializePool()
    console.log('Zimbra Incoming Sync Service Started (polling every 2 min)')

    // Run immediately
    await runSyncCycle()

    // Then poll
    setInterval(async () => {
        try {
            await runSyncCycle()
        } catch (err) {
            console.error('Poll error:', err)
        }
    }, POLL_INTERVAL)
}

startService().catch(err => {
    console.error('Fatal startup error:', err)
    process.exit(1)
})
