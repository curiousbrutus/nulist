import { NextRequest, NextResponse } from 'next/server'
import { bot, getUserByTelegramId, getUserTasks, updateTaskStatus, linkTelegramAccount } from '@/lib/telegram-bot'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// Temporary storage for registration flows (in production, use Redis or DB)
const registrationFlows = new Map<number, { step: string; data: any }>()

// POST /api/telegram/webhook - Telegram webhook handler
export async function POST(request: NextRequest) {
    try {
        if (!bot) {
            return NextResponse.json({ error: 'Bot not initialized' }, { status: 500 })
        }

        const update = await request.json()

        // Handle callback queries (inline button clicks)
        if (update.callback_query) {
            await handleCallbackQuery(update.callback_query)
            return NextResponse.json({ ok: true })
        }

        // Handle text messages
        if (update.message && update.message.text) {
            const message = update.message
            const chatId = message.chat.id
            const text = message.text
            const telegramUserId = String(message.from?.id)

            // Check if user exists
            const user = await getUserByTelegramId(telegramUserId)

            if (text === '/start') {
                if (user) {
                    await bot.sendMessage(
                        chatId,
                        `Merhaba ${user.full_name}! 👋\n\n` +
                        `NeoList hesabınız zaten bağlı.\n\n` +
                        `Komutlar:\n` +
                        `/tasks - Görevlerimi göster\n` +
                        `/help - Yardım`
                    )
                } else {
                    // Start registration
                    registrationFlows.set(chatId, { step: 'email', data: { telegram_user_id: telegramUserId } })
                    await bot.sendMessage(
                        chatId,
                        `🎯 NeoList'e Hoş Geldiniz!\n\n` +
                        `Hesabınızı bağlamak için lütfen e-posta adresinizi girin:\n\n` +
                        `Örnek: mehmet@optimedhastanetakip.com`
                    )
                }
            } else if (text === '/tasks') {
                if (!user) {
                    await bot.sendMessage(
                        chatId,
                        `❌ Hesabınız bağlı değil.\n\n` +
                        `/start komutunu kullanarak kaydolun.`
                    )
                } else {
                    await sendUserTasks(chatId, user.id)
                }
            } else if (text === '/help') {
                await bot.sendMessage(
                    chatId,
                    `📋 NeoList Bot Komutları:\n\n` +
                    `/start - Kaydol / Başla\n` +
                    `/tasks - Görevlerimi göster\n` +
                    `/help - Bu yardım mesajı\n\n` +
                    `Görevlerinizin durumunu değiştirmek için görev listesindeki butonları kullanın.`
                )
            } else {
                // Handle registration flow
                const flow = registrationFlows.get(chatId)
                if (flow) {
                    await handleRegistrationFlow(chatId, text, flow)
                } else if (!user) {
                    await bot.sendMessage(
                        chatId,
                        `Lütfen önce /start komutunu kullanın.`
                    )
                } else {
                    await bot.sendMessage(
                        chatId,
                        `Geçersiz komut. /help yazarak komutları görebilirsiniz.`
                    )
                }
            }
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        console.error('Telegram webhook error:', error)
        return NextResponse.json(
            { error: 'Webhook error', details: error.message },
            { status: 500 }
        )
    }
}

async function handleRegistrationFlow(chatId: number, text: string, flow: any) {
    if (!bot) return

    if (flow.step === 'email') {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(text)) {
            await bot.sendMessage(chatId, `❌ Geçersiz e-posta formatı. Lütfen tekrar deneyin:`)
            return
        }

        console.log(`Telegram registration attempt for email: ${text}`)

        // Check if email exists in system
        const profiles = await executeQuery(
            `SELECT id, email, full_name, telegram_user_id FROM profiles WHERE LOWER(email) = LOWER(:email)`,
            { email: text.trim() }
        )

        if (!profiles || profiles.length === 0) {
            const siteUrl = process.env.NEXTAUTH_URL || 'https://neolist.optimedhastanetakip.com'
            console.log(`Email not found in database: ${text}`)
            await bot.sendMessage(
                chatId,
                `❌ Bu e-posta (${text}) sistemde kayıtlı değil.\n\n` +
                `Lütfen önce web üzerinden hesap oluşturun veya e-postanızı kontrol edin:\n` +
                `${siteUrl}/login`
            )
            registrationFlows.delete(chatId)
            return
        }

        const profile = profiles[0]

        // Check if already linked
        if (profile.telegram_user_id) {
            await bot.sendMessage(
                chatId,
                `❌ Bu e-posta zaten başka bir Telegram hesabına bağlı.\n\n` +
                `Farklı bir e-posta deneyin veya destek ile iletişime geçin.`
            )
            registrationFlows.delete(chatId)
            return
        }

        // Link account
        const success = await linkTelegramAccount(profile.id, flow.data.telegram_user_id)

        if (success) {
            await bot.sendMessage(
                chatId,
                `✅ Hesabınız başarıyla bağlandı!\n\n` +
                `Hoş geldiniz ${profile.full_name}! 🎉\n\n` +
                `Komutlar:\n` +
                `/tasks - Görevlerimi göster\n` +
                `/help - Yardım`
            )
            registrationFlows.delete(chatId)
        } else {
            await bot.sendMessage(
                chatId,
                `❌ Hesap bağlanırken bir hata oluştu. Lütfen tekrar deneyin veya destek ile iletişime geçin.`
            )
            registrationFlows.delete(chatId)
        }
    }
}

async function sendUserTasks(chatId: number, userId: string) {
    if (!bot) return

    const tasks = await getUserTasks(userId)

    if (tasks.length === 0) {
        await bot.sendMessage(
            chatId,
            `📝 Aktif göreviniz bulunmuyor.\n\n` +
            `Tüm görevlerinizi tamamladınız! 🎉`
        )
        return
    }

    await bot.sendMessage(
        chatId,
        `📋 Aktif Görevleriniz (${tasks.length} adet):\n\n` +
        `Her görev için durum değiştirme butonları aşağıdadır:`
    )

    for (const task of tasks.slice(0, 10)) { // Limit to 10 tasks per message
        const priorityEmoji = {
            'Acil': '🔴',
            'Yüksek': '🟠',
            'Orta': '🟡',
            'Düşük': '🟢'
        }[task.priority as string] || '⚪'

        const message =
            `${priorityEmoji} *${task.title}*\n` +
            (task.notes ? `📄 ${task.notes.substring(0, 100)}${task.notes.length > 100 ? '...' : ''}\n` : '') +
            `📁 ${task.folder_name} / ${task.list_name}\n` +
            (task.due_date_formatted ? `⏰ Bitiş: ${task.due_date_formatted}\n` : '')

        const keyboard = {
            inline_keyboard: [[
                { text: '✅ Tamamlandı', callback_data: `complete_${task.id}` },
                { text: '🔄 Devam Ediyor', callback_data: `progress_${task.id}` }
            ], [
                { text: '❌ İptal', callback_data: `cancel_${task.id}` }
            ]]
        }

        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        })
    }

    if (tasks.length > 10) {
        await bot.sendMessage(
            chatId,
            `... ve ${tasks.length - 10} görev daha.\n\n` +
            `Tüm görevlerinizi web üzerinden görebilirsiniz.`
        )
    }
}

async function handleCallbackQuery(callbackQuery: any) {
    if (!bot) return

    const chatId = callbackQuery.message.chat.id
    const data = callbackQuery.data
    const telegramUserId = String(callbackQuery.from.id)

    // Get user
    const user = await getUserByTelegramId(telegramUserId)
    if (!user) {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Hesabınız bulunamadı. Lütfen /start ile kayıt olun.',
            show_alert: true
        })
        return
    }

    // Parse callback data
    const [action, taskId] = data.split('_')

    let status = 'pending'
    let statusText = ''

    if (action === 'complete') {
        status = 'completed'
        statusText = 'Tamamlandı ✅'
    } else if (action === 'progress') {
        status = 'in_progress'
        statusText = 'Devam Ediyor 🔄'
    } else if (action === 'cancel') {
        status = 'cancelled'
        statusText = 'İptal Edildi ❌'
    }

    // Update task
    const success = await updateTaskStatus(taskId, user.id, status)

    if (success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: `Görev durumu güncellendi: ${statusText}`,
            show_alert: false
        })

        // Update message to show new status
        await bot.editMessageReplyMarkup(
            { inline_keyboard: [[{ text: `${statusText}`, callback_data: 'done' }]] },
            {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            }
        )
    } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Görev güncellenirken hata oluştu.',
            show_alert: true
        })
    }
}
