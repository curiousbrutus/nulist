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
        // Use raw query without VPD context for system operations
        const profiles = await executeQuery(
            `SELECT id, email, full_name, role, branch, telegram_user_id 
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

// Helper: Get user tasks
export async function getUserTasks(userId: string) {
    try {
        const tasks = await executeQuery(
            `SELECT 
                t.id,
                t.title,
                t.notes,
                t.priority,
                TO_CHAR(t.due_date, 'DD.MM.YYYY HH24:MI') as due_date_formatted,
                t.is_completed,
                l.title as list_name,
                f.title as folder_name
             FROM tasks t
             LEFT JOIN task_assignees ta ON t.id = ta.task_id
             LEFT JOIN lists l ON t.list_id = l.id
             LEFT JOIN folders f ON l.folder_id = f.id
             WHERE ta.user_id = :user_id 
             AND t.is_completed = 0
             ORDER BY t.due_date NULLS LAST, t.created_at DESC`,
            { user_id: userId },
            userId
        )
        return tasks || []
    } catch (error) {
        console.error('Error fetching user tasks:', error)
        return []
    }
}

// Helper: Update task status
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
        }

        await executeNonQuery(
            `UPDATE tasks 
             SET is_completed = :is_completed, 
                 status = :status,
                 updated_at = SYSTIMESTAMP
             WHERE id = :task_id`,
            {
                is_completed: isCompleted,
                status: taskStatus,
                task_id: taskId
            },
            userId
        )

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
