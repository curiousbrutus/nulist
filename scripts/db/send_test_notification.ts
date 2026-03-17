import dotenv from 'dotenv'
import path from 'path'
import { closePool, executeQuery, initializePool } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
    const { createNotificationEvent } = await import('../../src/lib/notifications')
    const inputEmail = process.argv[2]

    await initializePool()

    const rows = inputEmail
        ? await executeQuery(
            `SELECT id, email, full_name, telegram_user_id
             FROM profiles
             WHERE LOWER(email) = LOWER(:email)
             FETCH FIRST 1 ROWS ONLY`,
            { email: inputEmail }
        )
        : await executeQuery(
            `SELECT id, email, full_name, telegram_user_id
             FROM profiles
             WHERE telegram_user_id IS NOT NULL
             ORDER BY updated_at DESC NULLS LAST
             FETCH FIRST 1 ROWS ONLY`
        )

    if (!rows?.[0]) {
        throw new Error('Test user not found (provide email or ensure at least one profile has telegram_user_id)')
    }

    const user = rows[0]
    const userId = String(user.id || user.ID)
    const email = String(user.email || user.EMAIL || '')
    const fullName = String(user.full_name || user.FULL_NAME || '')

    const eventId = await createNotificationEvent({
        eventType: 'task_status_changed',
        recipientUserIds: [userId],
        payload: {
            completed: false,
            task_title: 'Test Bildirimi - NeoList',
            note: 'Bu test bildirimi notification pipeline doğrulaması için gönderildi.'
        },
        dedupeSeed: `manual-test:${Date.now()}`
    })

    console.log('✅ Test notification enqueued')
    console.log({ event_id: eventId, user_id: userId, email, full_name: fullName })
}

main()
    .catch((error) => {
        console.error('❌ send_test_notification failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
