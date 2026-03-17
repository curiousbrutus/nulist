import dotenv from 'dotenv'
import path from 'path'
import { closePool, executeQuery, initializePool } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SCHEDULE_INTERVAL_MS = Number(process.env.NOTIFICATION_SCHEDULER_INTERVAL_MS || 300000)

let running = true
let createNotificationEvent: any = null

function nowInTimezone(timeZone: string) {
    const now = new Date()
    const local = new Date(now.toLocaleString('en-US', { timeZone }))
    return local
}

async function enqueueDueDateEvents() {
    const rows = await executeQuery(
        `SELECT t.id AS task_id,
                t.title,
                t.due_date,
                ta.user_id,
                ta.is_completed
         FROM tasks t
         JOIN task_assignees ta ON ta.task_id = t.id
         WHERE t.is_completed = 0
           AND ta.is_completed = 0
           AND t.due_date IS NOT NULL`
    )

    const now = new Date()

    for (const row of rows || []) {
        const taskId = String(row.task_id || row.TASK_ID)
        const userId = String(row.user_id || row.USER_ID)
        const dueDateRaw = row.due_date || row.DUE_DATE
        if (!dueDateRaw) continue

        const dueDate = new Date(dueDateRaw)
        const diffMs = dueDate.getTime() - now.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)

        if (diffHours <= 24 && diffHours > 0) {
            try {
                await createNotificationEvent({
                    eventType: 'task_due_soon',
                    taskId,
                    recipientUserIds: [userId],
                    payload: {
                        due_date: dueDate
                    },
                    dedupeSeed: `due-soon-24h:${taskId}:${userId}:${dueDate.toISOString().slice(0, 13)}`
                })
            } catch (error: any) {
                if (Number(error?.errorNum) !== 1 && !String(error?.message || '').includes('ORA-00001')) {
                    throw error
                }
            }
        }

        if (diffHours <= 0) {
            const today = now.toISOString().slice(0, 10)
            try {
                await createNotificationEvent({
                    eventType: 'task_overdue',
                    taskId,
                    recipientUserIds: [userId],
                    payload: {
                        due_date: dueDate
                    },
                    dedupeSeed: `overdue-daily:${taskId}:${userId}:${today}`
                })
            } catch (error: any) {
                if (Number(error?.errorNum) !== 1 && !String(error?.message || '').includes('ORA-00001')) {
                    throw error
                }
            }
        }
    }
}

async function enqueueDailySummaries() {
    const users = await executeQuery(
        `SELECT p.id,
                up.daily_summary_enabled,
                up.daily_summary_hour,
                up.timezone
         FROM profiles p
         LEFT JOIN notif_user_prefs up ON up.user_id = p.id
         WHERE p.id IS NOT NULL`
    )

    const utcToday = new Date().toISOString().slice(0, 10)

    for (const user of users || []) {
        const userId = String(user.id || user.ID)
        const enabled = Number(user.daily_summary_enabled ?? user.DAILY_SUMMARY_ENABLED ?? 1) === 1
        if (!enabled) continue

        const summaryHour = Number(user.daily_summary_hour ?? user.DAILY_SUMMARY_HOUR ?? 9)
        const timezone = String(user.timezone || user.TIMEZONE || 'Europe/Istanbul')
        const localNow = nowInTimezone(timezone)
        const localHour = localNow.getHours()
        const localMinute = localNow.getMinutes()

        if (localHour !== summaryHour || localMinute > 10) {
            continue
        }

        const counts = await executeQuery(
            `SELECT
                SUM(CASE WHEN ta.is_completed = 0 THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN ta.is_completed = 0 AND TRUNC(t.due_date) = TRUNC(SYSDATE) THEN 1 ELSE 0 END) AS due_today_count,
                SUM(CASE WHEN ta.is_completed = 0 AND t.due_date < SYSDATE THEN 1 ELSE 0 END) AS overdue_count
             FROM task_assignees ta
             JOIN tasks t ON t.id = ta.task_id
             WHERE ta.user_id = :user_id`,
            { user_id: userId }
        )

        const row = counts?.[0] || {}

        try {
            await createNotificationEvent({
                eventType: 'daily_summary',
                recipientUserIds: [userId],
                payload: {
                    open_count: Number(row.open_count ?? row.OPEN_COUNT ?? 0),
                    due_today_count: Number(row.due_today_count ?? row.DUE_TODAY_COUNT ?? 0),
                    overdue_count: Number(row.overdue_count ?? row.OVERDUE_COUNT ?? 0)
                },
                dedupeSeed: `daily-summary:${userId}:${utcToday}`
            })
        } catch (error: any) {
            if (Number(error?.errorNum) !== 1 && !String(error?.message || '').includes('ORA-00001')) {
                throw error
            }
        }
    }
}

async function runOnce() {
    await enqueueDueDateEvents()
    await enqueueDailySummaries()
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loop() {
    console.log('⏰ notifications_scheduler started')
    await initializePool()
    const notificationsLib = await import('../../src/lib/notifications')
    createNotificationEvent = notificationsLib.createNotificationEvent

    while (running) {
        try {
            await runOnce()
        } catch (error) {
            console.error('notifications_scheduler loop error:', error)
        }

        await sleep(SCHEDULE_INTERVAL_MS)
    }

    await closePool()
}

process.on('SIGINT', async () => {
    running = false
})

process.on('SIGTERM', async () => {
    running = false
})

loop().catch((error) => {
    console.error('notifications_scheduler fatal error:', error)
    process.exit(1)
})
