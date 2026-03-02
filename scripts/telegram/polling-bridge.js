require('dotenv').config({ path: '.env.local' })

const token = process.env.TELEGRAM_BOT_TOKEN
const appPort = Number(process.env.APP_PORT || process.env.PORT || 4554)
const internalWebhookUrl = process.env.TELEGRAM_INTERNAL_WEBHOOK_URL || `http://127.0.0.1:${appPort}/api/telegram/webhook`
const telegramBaseUrl = `https://api.telegram.org/bot${token}`

if (!token) {
    console.error('[telegram-polling-bridge] TELEGRAM_BOT_TOKEN is missing')
    process.exit(1)
}

let offset = 0
let stopping = false

async function deleteWebhookForPolling() {
    const response = await fetch(`${telegramBaseUrl}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_pending_updates: false })
    })

    const data = await response.json()
    if (!data.ok) {
        throw new Error(`deleteWebhook failed: ${data.description || 'unknown error'}`)
    }
}

async function fetchUpdates() {
    const response = await fetch(`${telegramBaseUrl}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            offset,
            timeout: 50,
            allowed_updates: ['message', 'callback_query']
        })
    })

    const data = await response.json()
    if (!data.ok) {
        throw new Error(`getUpdates failed: ${data.description || 'unknown error'}`)
    }

    return Array.isArray(data.result) ? data.result : []
}

async function forwardUpdate(update) {
    const response = await fetch(internalWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
    })

    if (!response.ok) {
        const body = await response.text()
        throw new Error(`forward failed (${response.status}): ${body}`)
    }
}

async function loop() {
    while (!stopping) {
        try {
            const updates = await fetchUpdates()

            if (updates.length > 0) {
                console.log(`[telegram-polling-bridge] fetched ${updates.length} update(s), offset=${offset}`)
            }

            for (const update of updates) {
                await forwardUpdate(update)
                const kind = update.callback_query ? 'callback_query' : (update.message ? 'message' : 'other')
                console.log(`[telegram-polling-bridge] forwarded update_id=${update.update_id} kind=${kind}`)
                offset = Math.max(offset, (update.update_id || 0) + 1)
            }
        } catch (error) {
            console.error('[telegram-polling-bridge] loop error:', error.message)
            await new Promise((resolve) => setTimeout(resolve, 3000))
        }
    }
}

async function start() {
    console.log('[telegram-polling-bridge] Starting...')
    console.log(`[telegram-polling-bridge] Internal webhook target: ${internalWebhookUrl}`)

    await deleteWebhookForPolling()
    console.log('[telegram-polling-bridge] Telegram webhook deleted, polling mode active')

    await loop()
}

process.on('SIGINT', () => {
    stopping = true
})

process.on('SIGTERM', () => {
    stopping = true
})

start().catch((error) => {
    console.error('[telegram-polling-bridge] fatal error:', error)
    process.exit(1)
})
