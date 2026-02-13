import TelegramBot from 'node-telegram-bot-api'
import { executeQuery, executeNonQuery } from './oracle'

// Initialize bot
const token = process.env.TELEGRAM_BOT_TOKEN
let bot: TelegramBot | null = null

if (token) {
    bot = new TelegramBot(token, { polling: false }) // Use webhook mode, not polling
    console.log('Telegram bot initialized')
} else {
    console.warn('TELEGRAM_BOT_TOKEN not found in environment variables')
}

export { bot }

// Helper: Get user profile by telegram_user_id
export async function getUserByTelegramId(telegramUserId: string) {
    try {
        const profiles = await executeQuery(
            `SELECT id, email, full_name, role, branch, telegram_user_id, zimbra_sync_enabled
             FROM profiles
             WHERE telegram_user_id = :telegram_user_id`,
            { telegram_user_id: telegramUserId }
        )
        return profiles && profiles.length > 0 ? profiles[0] : null
    } catch (error) {
        console.error('Error fetching user by telegram ID:', error)
        return null
    }
}

// Helper: Get user's active tasks (assignee-level)
export async function getUserTasks(userId: string) {
    try {
        const tasks = await executeQuery(
            `SELECT
                t.id,
                t.title,
                t.notes,
                t.priority,
                t.status,
                TO_CHAR(t.due_date, 'DD.MM.YYYY HH24:MI') as due_date_formatted,
                ta.is_completed as assignee_completed,
                ta.zimbra_task_id,
                l.title as list_name,
                f.title as folder_name
             FROM tasks t
             JOIN task_assignees ta ON t.id = ta.task_id
             LEFT JOIN lists l ON t.list_id = l.id
             LEFT JOIN folders f ON l.folder_id = f.id
             WHERE ta.user_id = :user_id
             AND ta.is_completed = 0
             ORDER BY
                CASE t.priority
                    WHEN 'Acil' THEN 1
                    WHEN 'Yüksek' THEN 2
                    WHEN 'Orta' THEN 3
                    WHEN 'Düşük' THEN 4
                    ELSE 5
                END,
                t.due_date NULLS LAST,
                t.created_at DESC`,
            { user_id: userId },
            userId
        )
        return tasks || []
    } catch (error) {
        console.error('Error fetching user tasks:', error)
        return []
    }
}

// Helper: Update task status for a specific assignee + queue Zimbra sync
export async function updateTaskStatus(taskId: string, userId: string, status: string) {
    try {
        let isCompleted = 0
        let taskStatus = 'pending'

        if (status === 'completed') {
            isCompleted = 1
            taskStatus = 'completed'
        } else if (status === 'in_progress') {
            taskStatus = 'in_progress'
        } else if (status === 'cancelled') {
            taskStatus = 'cancelled'
        } else if (status === 'waiting') {
            taskStatus = 'waiting'
        } else if (status === 'deferred') {
            taskStatus = 'deferred'
        }

        // 1. Update assignee-level completion
        await executeNonQuery(
            `UPDATE task_assignees
             SET is_completed = :is_completed
             WHERE task_id = :task_id AND user_id = :user_id`,
            {
                is_completed: isCompleted,
                task_id: taskId,
                user_id: userId
            },
            userId
        )

        // 2. Check if ALL assignees are done -> update the task itself
        const remaining = await executeQuery(
            `SELECT COUNT(*) as cnt
             FROM task_assignees
             WHERE task_id = :task_id AND is_completed = 0`,
            { task_id: taskId }
        )
        const allDone = remaining.length > 0 && (remaining[0].cnt === 0)

        if (allDone && status === 'completed') {
            await executeNonQuery(
                `UPDATE tasks SET is_completed = 1, status = 'completed' WHERE id = :task_id`,
                { task_id: taskId },
                userId
            )
        } else {
            // Update task status but don't mark globally completed
            await executeNonQuery(
                `UPDATE tasks SET status = :task_status WHERE id = :task_id AND is_completed = 0`,
                { task_status: taskStatus, task_id: taskId },
                userId
            )
        }

        // 3. Queue Zimbra sync if user has sync enabled
        try {
            const syncInfo = await executeQuery(
                `SELECT ta.zimbra_task_id, p.email, p.zimbra_sync_enabled,
                        t.title, t.notes, t.due_date, t.priority
                 FROM task_assignees ta
                 JOIN profiles p ON ta.user_id = p.id
                 JOIN tasks t ON ta.task_id = t.id
                 WHERE ta.task_id = :task_id AND ta.user_id = :user_id`,
                { task_id: taskId, user_id: userId }
            )

            if (syncInfo.length > 0) {
                const info = syncInfo[0]
                if (info.zimbra_sync_enabled === 1 && info.zimbra_task_id && info.email) {
                    const payload = JSON.stringify({
                        zimbra_task_id: info.zimbra_task_id,
                        email: info.email,
                        title: info.title || info.TITLE,
                        notes: info.notes || info.NOTES || '',
                        due_date: info.due_date || info.DUE_DATE,
                        priority: info.priority || info.PRIORITY || 'Orta',
                        status: taskStatus,
                        is_completed: status === 'completed'
                    })

                    await executeNonQuery(
                        `INSERT INTO sync_queue (id, task_id, user_email, action_type, payload, status)
                         VALUES (SYS_GUID(), :tid, :uemail, 'UPDATE', :payload, 'PENDING')`,
                        { tid: taskId, uemail: info.email, payload }
                    )
                }
            }
        } catch (syncErr) {
            console.error('Telegram->Zimbra sync queue error (non-blocking):', syncErr)
        }

        return true
    } catch (error) {
        console.error('Error updating task status:', error)
        return false
    }
}

// Helper: Link Telegram account to profile
export async function linkTelegramAccount(userId: string, telegramUserId: string) {
    try {
        await executeNonQuery(
            `UPDATE profiles
             SET telegram_user_id = :telegram_user_id,
                 updated_at = SYSTIMESTAMP
             WHERE id = :user_id`,
            {
                telegram_user_id: telegramUserId,
                user_id: userId
            },
            userId
        )
        return true
    } catch (error) {
        console.error('Error linking Telegram account:', error)
        return false
    }
}
