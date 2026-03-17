import dotenv from 'dotenv'
import path from 'path'
import { closePool, executeQuery, initializePool } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
    const eventId = process.argv[2]
    if (!eventId) {
        throw new Error('Usage: npx tsx scripts/db/check_notification_event.ts <event_id>')
    }

    await initializePool()

    const rows = await executeQuery(
        `SELECT id, user_id, channel, status, retry_count, last_error, sent_at, created_at
         FROM notif_deliveries
         WHERE event_id = :event_id
         ORDER BY channel`,
        { event_id: eventId }
    )

    console.table(rows)
}

main()
    .catch((error) => {
        console.error('❌ check_notification_event failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
