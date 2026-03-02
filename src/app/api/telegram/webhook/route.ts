import { NextRequest, NextResponse } from 'next/server'
import { bot, getUserByTelegramId, getUserTasks, updateTaskStatus, linkTelegramAccount } from '@/lib/telegram-bot'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// Temporary storage for registration flows (in production, use Redis or DB)
const registrationFlows = new Map<number, { step: string; data: any }>()

// POST /api/telegram/webhook - Telegram webhook handler
export async function POST(request: NextRequest) {
    try {
        const update = await request.json()

        processTelegramUpdate(update).catch((error: any) => {
            console.error('Telegram async processing error:', error)
        })

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        console.error('Telegram webhook parse error:', error)
        return NextResponse.json({ ok: true })
    }
}

async function processTelegramUpdate(update: any) {
    if (!bot) {
        console.warn('Telegram webhook received update but bot is not initialized')
        return
    }

    // Handle callback queries (inline button clicks)
    if (update.callback_query) {
        await handleCallbackQuery(update.callback_query)
        return
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
            registrationFlows.delete(chatId)
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
                registrationFlows.set(chatId, { step: 'email', data: { telegram_user_id: telegramUserId } })
                await bot.sendMessage(
                    chatId,
                    `🎯 NeoList'e Hoş Geldiniz!\n\n` +
                    `Hesabınızı bağlamak için lütfen e-posta adresinizi girin:\n\n` +
                    `Örnek: mehmet@optimedhastanetakip.com`
                )
            }
        } else if (text === '/tasks') {
            registrationFlows.delete(chatId)
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
            registrationFlows.delete(chatId)
            await bot.sendMessage(
                chatId,
                `📋 NeoList Bot Komutları:\n\n` +
                `/start - Kaydol / Başla\n` +
                `/tasks - Görevlerimi göster\n` +
                `/cancel - İşlemi iptal et\n` +
                `/help - Bu yardım mesajı\n\n` +
                `Görevlerinizin durumunu değiştirmek için görev listesindeki butonları kullanın.`
            )
        } else if (text === '/cancel') {
            const flow = registrationFlows.get(chatId)
            registrationFlows.delete(chatId)
            if (flow) {
                await bot.sendMessage(chatId, '❌ İşlem iptal edildi.')
            } else {
                await bot.sendMessage(chatId, 'İptal edilecek bir işlem yok.')
            }
        } else {
            const flow = registrationFlows.get(chatId)
            if (flow) {
                if (flow.step === 'write_note') {
                    await handleNoteFlow(chatId, text, flow)
                } else {
                    await handleRegistrationFlow(chatId, text, flow)
                }
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

async function handleNoteFlow(chatId: number, text: string, flow: any) {
    if (!bot) return

    // Allow user to cancel with /cancel command
    if (text.trim() === '/cancel') {
        registrationFlows.delete(chatId)
        await bot.sendMessage(chatId, '❌ Not yazma iptal edildi.')
        return
    }

    const { task_id, user_id } = flow.data
    const content = text.trim()

    if (content.length < 1) {
        await bot.sendMessage(chatId, '❌ Not boş olamaz. Lütfen tekrar yazın veya /cancel ile iptal edin.')
        return
    }

    if (content.length > 2000) {
        await bot.sendMessage(chatId, '❌ Not çok uzun (maks 2000 karakter). Lütfen kısaltıp tekrar yazın.')
        return
    }

    try {
        const newId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await executeNonQuery(
            `INSERT INTO comments (id, task_id, user_id, content)
             VALUES (:id, :task_id, :user_id, :content)`,
            {
                id: newId,
                task_id,
                user_id,
                content
            },
            user_id
        )

        registrationFlows.delete(chatId)
        await bot.sendMessage(chatId, '✅ Not başarıyla eklendi!')
    } catch (error: any) {
        console.error('Error adding note via Telegram:', error)
        registrationFlows.delete(chatId)
        await bot.sendMessage(chatId, '❌ Not eklenirken bir hata oluştu. Lütfen tekrar deneyin.')
    }
}

// Escape special characters for Telegram Markdown
function escapeMarkdown(text: string): string {
    return text.replace(/([*_`\[\]])/g, '\\$1')
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

        const safeTitle = escapeMarkdown(task.title || '')
        const safeNotes = task.notes ? escapeMarkdown(task.notes.substring(0, 100)) : ''
        const safeFolderName = escapeMarkdown(task.folder_name || '')
        const safeListName = escapeMarkdown(task.list_name || '')

        const message =
            `${priorityEmoji} *${safeTitle}*\n` +
            (task.notes ? `📄 ${safeNotes}${task.notes.length > 100 ? '...' : ''}\n` : '') +
            `📁 ${safeFolderName} / ${safeListName}\n` +
            (task.due_date_formatted ? `⏰ Bitiş: ${task.due_date_formatted}\n` : '')

        const keyboard = {
            inline_keyboard: [[
                { text: '✅ Tamamlandı', callback_data: `complete_${task.id}` },
                { text: '🔄 Devam Ediyor', callback_data: `progress_${task.id}` }
            ], [
                { text: '⏳ Bekleniyor', callback_data: `waiting_${task.id}` },
                { text: '📅 Ertelendi', callback_data: `deferred_${task.id}` }
            ], [
                { text: '❌ İptal', callback_data: `cancel_${task.id}` },
                { text: '📝 Not Yaz', callback_data: `note_${task.id}` }
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

    // Parse callback data - split only on FIRST underscore to preserve UUID task IDs
    // e.g. 'complete_f1e92906-fe6f-4df9-9f75-9db6d0e02599'
    if (data === 'done') {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Bu görev zaten güncellendi.',
            show_alert: false
        })
        return
    }

    if (data === 'cancel_note') {
        registrationFlows.delete(chatId)
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Not yazma iptal edildi.',
            show_alert: false
        })
        await bot.editMessageText('❌ Not yazma iptal edildi.', {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id
        })
        return
    }

    const separatorIndex = data.indexOf('_')
    if (separatorIndex === -1) {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Geçersiz işlem.',
            show_alert: true
        })
        return
    }
    const action = data.substring(0, separatorIndex)
    const taskId = data.substring(separatorIndex + 1)

    let status = 'pending'
    let statusText = ''

    if (action === 'complete') {
        status = 'completed'
        statusText = 'Tamamlandı ✅'
    } else if (action === 'progress') {
        status = 'in_progress'
        statusText = 'Devam Ediyor 🔄'
    } else if (action === 'waiting') {
        status = 'waiting'
        statusText = 'Başkası Bekleniyor ⏳'
    } else if (action === 'deferred') {
        status = 'deferred'
        statusText = 'Ertelendi 📅'
    } else if (action === 'cancel') {
        status = 'cancelled'
        statusText = 'İptal Edildi ❌'
    } else if (action === 'note') {
        // Enter note-writing mode
        registrationFlows.set(chatId, {
            step: 'write_note',
            data: { task_id: taskId, user_id: user.id }
        })

        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Not yazma modu aktif',
            show_alert: false
        })

        await bot.sendMessage(
            chatId,
            `📝 Lütfen notunuzu yazın:\n\n(İptal etmek için /cancel yazın)`,
            { reply_markup: { inline_keyboard: [[{ text: '❌ İptal', callback_data: 'cancel_note' }]] } }
        )
        return
    } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Bilinmeyen işlem.',
            show_alert: true
        })
        return
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
