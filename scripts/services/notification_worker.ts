import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const POLL_INTERVAL_MS = Number(process.env.NOTIFICATION_WORKER_POLL_MS || 10000)
const BATCH_SIZE = Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE || 50)

let running = true

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loop() {
    console.log('🔔 notification_worker started')
    await initializePool()
    const { processPendingNotificationDeliveries } = await import('../../src/lib/notifications')

    while (running) {
        try {
            const processed = await processPendingNotificationDeliveries(BATCH_SIZE)
            if (processed > 0) {
                console.log(`🔔 notification_worker processed ${processed} deliveries`)
            }
        } catch (error) {
            console.error('notification_worker loop error:', error)
        }

        await sleep(POLL_INTERVAL_MS)
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
    console.error('notification_worker fatal error:', error)
    process.exit(1)
})
