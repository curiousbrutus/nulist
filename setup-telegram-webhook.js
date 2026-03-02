/**
 * Setup Telegram Webhook
 *
 * Priority:
 * 1) CLI arg (domain or full webhook URL)
 * 2) TELEGRAM_WEBHOOK_URL
 * 3) NEXTAUTH_URL + /api/telegram/webhook
 */

require('dotenv').config({ path: '.env.local' })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

function resolveWebhookUrl(inputUrl) {
    if (inputUrl) {
        const cleaned = inputUrl.replace(/\/$/, '')
        if (cleaned.endsWith('/api/telegram/webhook')) {
            return cleaned
        }
        return `${cleaned}/api/telegram/webhook`
    }

    if (process.env.TELEGRAM_WEBHOOK_URL) {
        return process.env.TELEGRAM_WEBHOOK_URL.replace(/\/$/, '')
    }

    if (process.env.NEXTAUTH_URL) {
        return `${process.env.NEXTAUTH_URL.replace(/\/$/, '')}/api/telegram/webhook`
    }

    return null
}

async function setupWebhook(inputUrl) {
    if (!TOKEN) {
        console.error('❌ Error: TELEGRAM_BOT_TOKEN is missing (.env.local)')
        process.exit(1)
    }

    const webhookUrl = resolveWebhookUrl(inputUrl)

    if (!webhookUrl) {
        console.error('❌ Error: Please provide webhook URL or set TELEGRAM_WEBHOOK_URL/NEXTAUTH_URL')
        console.log('\nUsage:')
        console.log('  node setup-telegram-webhook.js https://your-domain.com')
        console.log('  node setup-telegram-webhook.js https://your-domain.com/api/telegram/webhook')
        process.exit(1)
    }

    console.log('🔧 Setting up Telegram webhook...\n')
    console.log(`📍 Webhook URL: ${webhookUrl}\n`)

    try {
        // Set webhook
        const response = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl })
        })

        const data = await response.json()

        if (data.ok) {
            console.log('✅ Webhook registered successfully!\n')
            
            // Get webhook info to verify
            const infoResponse = await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)
            const info = await infoResponse.json()
            
            if (info.ok) {
                console.log('📋 Webhook Info:')
                console.log(`   URL: ${info.result.url}`)
                console.log(`   Pending updates: ${info.result.pending_update_count}`)
                if (info.result.last_error_date) {
                    console.log(`   ⚠️  Last error: ${info.result.last_error_message}`)
                }
            }
            
            console.log('\n✨ Setup complete!')
            console.log('👉 Now open Telegram and send /start to @clawdbot5449bot')
        } else {
            console.error('❌ Failed to set webhook:', data.description)
        }
    } catch (error) {
        console.error('❌ Error:', error.message)
    }
}

const inputUrl = process.argv[2]
setupWebhook(inputUrl)
