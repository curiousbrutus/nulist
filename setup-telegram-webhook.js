/**
 * Setup Telegram Webhook
 * 
 * This script registers your webhook URL with Telegram
 * Run AFTER your dev server is running on a public URL (ngrok/cloudflare tunnel)
 * 
 * Usage:
 *   node setup-telegram-webhook.js https://your-public-url.com
 */

const TOKEN = '8506599800:AAE-5hw51xThKpg_Uy3hbOEJd8nQ_3E_oHc'

async function setupWebhook(publicUrl) {
    if (!publicUrl) {
        console.error('❌ Error: Please provide your public URL')
        console.log('\nUsage:')
        console.log('  node setup-telegram-webhook.js https://your-domain.com')
        console.log('\nFor local development, use ngrok or cloudflare tunnel:')
        console.log('  ngrok http 3000')
        console.log('  Then use the ngrok URL: https://abc123.ngrok.io')
        process.exit(1)
    }

    // Remove trailing slash
    publicUrl = publicUrl.replace(/\/$/, '')
    const webhookUrl = `${publicUrl}/api/telegram/webhook`

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

// Get URL from command line argument
const publicUrl = process.argv[2]
setupWebhook(publicUrl)
