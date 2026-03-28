import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import { bot } from './telegram-bot'
import { executeNonQuery, executeQuery } from './oracle'

type NotificationChannel = 'telegram' | 'email' | 'in_app'

type NotificationEventType =
    | 'task_assigned'
    | 'task_assigned_to_subordinate'
    | 'task_due_soon'
    | 'task_overdue'
    | 'task_status_changed'
    | 'comment_added'
    | 'daily_summary'

interface CreateNotificationEventInput {
    eventType: NotificationEventType
    taskId?: string | null
    actorUserId?: string | null
    recipientUserIds: string[]
    payload?: Record<string, any>
    dedupeSeed?: string
}

interface MailTransportConfig {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
    from: string
}

let mailTransporter: nodemailer.Transporter | null = null

interface TaskContext {
    id: string
    title: string
    due_date?: string | Date | null
    folder_title?: string
    list_title?: string
}

function generateId(prefix: string) {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function resolveMailTransportConfig(): MailTransportConfig | null {
    const provider = String(process.env.NOTIFY_MAIL_PROVIDER || process.env.MAIL_PROVIDER || 'zimbra').toLowerCase()

    const pick = (keys: string[]) => {
        for (const key of keys) {
            const value = process.env[key]
            if (value && String(value).trim()) return String(value).trim()
        }
        return ''
    }

    const commonFallback = {
        host: pick(['SMTP_HOST']),
        port: Number(pick(['SMTP_PORT']) || '587'),
        secure: pick(['SMTP_SECURE']) === '1' || pick(['SMTP_SECURE']).toLowerCase() === 'true',
        user: pick(['SMTP_USER']),
        pass: pick(['SMTP_PASS']),
        from: pick(['SMTP_FROM'])
    }

    if (provider === 'outlook') {
        const config: MailTransportConfig = {
            host: pick(['OUTLOOK_SMTP_HOST']) || commonFallback.host || 'smtp.office365.com',
            port: Number(pick(['OUTLOOK_SMTP_PORT']) || commonFallback.port || 587),
            secure: pick(['OUTLOOK_SMTP_SECURE']) === '1' || pick(['OUTLOOK_SMTP_SECURE']).toLowerCase() === 'true' || commonFallback.secure,
            user: pick(['OUTLOOK_SMTP_USER']) || commonFallback.user,
            pass: pick(['OUTLOOK_SMTP_PASS']) || commonFallback.pass,
            from: pick(['OUTLOOK_SMTP_FROM']) || commonFallback.from
        }
        if (!config.host || !config.user || !config.pass || !config.from) return null
        return config
    }

    if (provider === 'custom' || provider === 'smtp') {
        if (!commonFallback.host || !commonFallback.user || !commonFallback.pass || !commonFallback.from) return null
        return {
            host: commonFallback.host,
            port: commonFallback.port || 587,
            secure: commonFallback.secure,
            user: commonFallback.user,
            pass: commonFallback.pass,
            from: commonFallback.from
        }
    }

    const zimbraConfig: MailTransportConfig = {
        host: pick(['ZIMBRA_SMTP_HOST']) || commonFallback.host,
        port: Number(pick(['ZIMBRA_SMTP_PORT']) || commonFallback.port || 587),
        secure: pick(['ZIMBRA_SMTP_SECURE']) === '1' || pick(['ZIMBRA_SMTP_SECURE']).toLowerCase() === 'true' || commonFallback.secure,
        user: pick(['ZIMBRA_SMTP_USER']) || commonFallback.user,
        pass: pick(['ZIMBRA_SMTP_PASS']) || commonFallback.pass,
        from: pick(['ZIMBRA_SMTP_FROM']) || commonFallback.from
    }

    if (!zimbraConfig.host || !zimbraConfig.user || !zimbraConfig.pass || !zimbraConfig.from) return null
    return zimbraConfig
}

function getMailTransporter(): nodemailer.Transporter | null {
    if (mailTransporter) return mailTransporter

    const config = resolveMailTransportConfig()
    if (!config) return null

    mailTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        }
    })

    return mailTransporter
}

function toBool(value: any, fallback = true) {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1
    if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
    return fallback
}

async function ensurePreferenceRow(userId: string) {
    await executeNonQuery(
        `BEGIN
            INSERT INTO notif_user_prefs (
                id, user_id, telegram_enabled, email_enabled, in_app_enabled, daily_summary_enabled, daily_summary_hour, timezone
            ) VALUES (
                :id, :user_id, 1, 1, 1, 1, 9, 'Europe/Istanbul'
            );
        EXCEPTION
            WHEN DUP_VAL_ON_INDEX THEN NULL;
        END;`,
        { id: generateId('notif_pref'), user_id: userId }
    )
}

async function getUserChannelPreferences(userId: string): Promise<Record<NotificationChannel, boolean>> {
    await ensurePreferenceRow(userId)

    const rows = await executeQuery(
        `SELECT telegram_enabled, email_enabled, in_app_enabled
         FROM notif_user_prefs
         WHERE user_id = :user_id`,
        { user_id: userId }
    )

    const row = rows?.[0] || {}

    return {
        telegram: toBool(row.telegram_enabled ?? row.TELEGRAM_ENABLED, true),
        email: toBool(row.email_enabled ?? row.EMAIL_ENABLED, true),
        in_app: toBool(row.in_app_enabled ?? row.IN_APP_ENABLED, true)
    }
}

export async function getTaskContext(taskId?: string | null): Promise<TaskContext | null> {
    if (!taskId) return null

    const rows = await executeQuery(
        `SELECT t.id, t.title, t.due_date, l.title AS list_title, f.title AS folder_title
         FROM tasks t
         LEFT JOIN lists l ON l.id = t.list_id
         LEFT JOIN folders f ON f.id = l.folder_id
         WHERE t.id = :id`,
        { id: taskId }
    )

    if (!rows?.[0]) return null
    const row = rows[0]

    return {
        id: String(row.id || row.ID),
        title: String(row.title || row.TITLE || ''),
        due_date: row.due_date || row.DUE_DATE,
        list_title: row.list_title || row.LIST_TITLE,
        folder_title: row.folder_title || row.FOLDER_TITLE
    }
}

function buildIdempotencyKey(input: {
    eventType: NotificationEventType
    taskId?: string | null
    userId: string
    channel: NotificationChannel
    dedupeSeed?: string
}) {
    const raw = `${input.eventType}|${input.taskId || 'none'}|${input.userId}|${input.channel}|${input.dedupeSeed || 'default'}`
    return crypto.createHash('sha1').update(raw).digest('hex')
}

export async function createNotificationEvent(input: CreateNotificationEventInput): Promise<string | null> {
    const recipients = Array.from(new Set((input.recipientUserIds || []).filter(Boolean)))
    if (recipients.length === 0) return null

    const eventId = generateId('notif_evt')

    await executeNonQuery(
        `INSERT INTO notif_events (id, event_type, task_id, actor_user_id, payload)
         VALUES (:id, :event_type, :task_id, :actor_user_id, :payload)`,
        {
            id: eventId,
            event_type: input.eventType,
            task_id: input.taskId || null,
            actor_user_id: input.actorUserId || null,
            payload: JSON.stringify(input.payload || {})
        },
        input.actorUserId || undefined
    )

    for (const userId of recipients) {
        const channels = await getUserChannelPreferences(userId)

        const channelList: NotificationChannel[] = ['in_app', 'telegram', 'email']
        for (const channel of channelList) {
            if (!channels[channel]) continue

            const deliveryId = generateId('notif_del')
            const idempotencyKey = buildIdempotencyKey({
                eventType: input.eventType,
                taskId: input.taskId,
                userId,
                channel,
                dedupeSeed: input.dedupeSeed
            })

            try {
                await executeNonQuery(
                    `INSERT INTO notif_deliveries (
                        id, event_id, user_id, channel, status, retry_count, idempotency_key
                     ) VALUES (
                        :id, :event_id, :user_id, :channel, 'PENDING', 0, :idempotency_key
                     )`,
                    {
                        id: deliveryId,
                        event_id: eventId,
                        user_id: userId,
                        channel,
                        idempotency_key: idempotencyKey
                    },
                    input.actorUserId || undefined
                )
            } catch (error: any) {
                if (!String(error?.message || '').includes('ORA-00001')) {
                    console.error('Failed to enqueue notification delivery:', error)
                }
            }
        }
    }

    return eventId
}

function parseJson(value: any): Record<string, any> {
    if (!value) return {}
    if (typeof value === 'object') return value as Record<string, any>
    if (typeof value !== 'string') return {}
    try {
        return JSON.parse(value)
    } catch {
        return {}
    }
}

function formatDateTR(value: any): string {
    if (!value) return '-'
    try {
        return new Date(value).toLocaleString('tr-TR')
    } catch {
        return String(value)
    }
}

function buildNotificationContent(args: {
    eventType: NotificationEventType
    taskContext: TaskContext | null
    payload: Record<string, any>
}): { title: string; body: string } {
    const taskTitle = args.taskContext?.title || args.payload.task_title || 'Görev'
    const listPath = args.taskContext
        ? [args.taskContext.folder_title, args.taskContext.list_title].filter(Boolean).join(' / ')
        : ''

    if (args.eventType === 'task_assigned') {
        return {
            title: 'Yeni görev atandı',
            body: `${taskTitle}${listPath ? `\n${listPath}` : ''}`
        }
    }

    if (args.eventType === 'task_assigned_to_subordinate') {
        const subordinateName = args.payload?.subordinate_name || 'Personeliniz'
        return {
            title: 'Personelinize görev atandı',
            body: `${subordinateName}: ${taskTitle}${listPath ? `\n${listPath}` : ''}`
        }
    }

    if (args.eventType === 'task_due_soon') {
        return {
            title: 'Termin yaklaşıyor',
            body: `${taskTitle}\nTermin: ${formatDateTR(args.taskContext?.due_date || args.payload.due_date)}`
        }
    }

    if (args.eventType === 'task_overdue') {
        return {
            title: 'Termin geçti',
            body: `${taskTitle}\nTermin: ${formatDateTR(args.taskContext?.due_date || args.payload.due_date)}`
        }
    }

    if (args.eventType === 'task_status_changed') {
        const statusLabel = args.payload?.completed ? 'Tamamlandı' : 'Yeniden açıldı'
        return {
            title: `Durum güncellendi: ${statusLabel}`,
            body: `${taskTitle}${listPath ? `\n${listPath}` : ''}`
        }
    }

    if (args.eventType === 'comment_added') {
        return {
            title: 'Göreve yeni yorum eklendi',
            body: `${taskTitle}\n${String(args.payload?.content || '').slice(0, 200)}`
        }
    }

    if (args.eventType === 'daily_summary') {
        return {
            title: 'Günlük görev özeti',
            body: `Açık: ${args.payload?.open_count || 0} | Bugün terminli: ${args.payload?.due_today_count || 0} | Geciken: ${args.payload?.overdue_count || 0}`
        }
    }

    return {
        title: 'Bildirim',
        body: taskTitle
    }
}

async function markDeliveryStatus(params: {
    deliveryId: string
    status: 'SENT' | 'FAILED' | 'SKIPPED' | 'PENDING'
    lastError?: string | null
}) {
    await executeNonQuery(
        `UPDATE notif_deliveries
         SET status = :status,
             last_error = :last_error,
             updated_at = SYSTIMESTAMP,
             sent_at = CASE WHEN :status = 'SENT' THEN SYSTIMESTAMP ELSE sent_at END,
             retry_count = CASE WHEN :status = 'FAILED' THEN retry_count + 1 ELSE retry_count END
         WHERE id = :id`,
        {
            status: params.status,
            last_error: params.lastError || null,
            id: params.deliveryId
        }
    )
}

async function deliverInApp(args: {
    deliveryId: string
    userId: string
    eventId: string
    title: string
    body: string
}) {
    await executeNonQuery(
        `INSERT INTO inapp_notifications (id, user_id, event_id, title, body, is_read)
         VALUES (:id, :user_id, :event_id, :title, :body, 0)`,
        {
            id: generateId('inapp'),
            user_id: args.userId,
            event_id: args.eventId,
            title: args.title,
            body: args.body
        }
    )

    await markDeliveryStatus({ deliveryId: args.deliveryId, status: 'SENT' })
}

async function deliverTelegram(args: {
    deliveryId: string
    userId: string
    title: string
    body: string
}) {
    if (!bot) {
        await markDeliveryStatus({
            deliveryId: args.deliveryId,
            status: 'SKIPPED',
            lastError: 'Telegram bot not initialized'
        })
        return
    }

    const rows = await executeQuery(
        `SELECT telegram_user_id FROM profiles WHERE id = :id`,
        { id: args.userId }
    )
    const telegramUserId = rows?.[0]?.telegram_user_id || rows?.[0]?.TELEGRAM_USER_ID

    if (!telegramUserId) {
        await markDeliveryStatus({
            deliveryId: args.deliveryId,
            status: 'SKIPPED',
            lastError: 'No telegram_user_id linked'
        })
        return
    }

    await bot.sendMessage(String(telegramUserId), `🔔 *${args.title}*\n${args.body}`, {
        parse_mode: 'Markdown'
    })

    await markDeliveryStatus({ deliveryId: args.deliveryId, status: 'SENT' })
}

async function deliverEmail(args: {
    deliveryId: string
    userId: string
    title: string
    body: string
}) {
    const transporter = getMailTransporter()
    if (!transporter) {
        await markDeliveryStatus({
            deliveryId: args.deliveryId,
            status: 'SKIPPED',
            lastError: 'SMTP config not found (set NOTIFY_MAIL_PROVIDER + SMTP env vars)'
        })
        return
    }

    const rows = await executeQuery(
        `SELECT email FROM profiles WHERE id = :id`,
        { id: args.userId }
    )
    const recipientEmail = rows?.[0]?.email || rows?.[0]?.EMAIL

    if (!recipientEmail) {
        await markDeliveryStatus({
            deliveryId: args.deliveryId,
            status: 'SKIPPED',
            lastError: 'Recipient email not found'
        })
        return
    }

    const config = resolveMailTransportConfig()
    if (!config?.from) {
        await markDeliveryStatus({
            deliveryId: args.deliveryId,
            status: 'SKIPPED',
            lastError: 'SMTP from address not configured'
        })
        return
    }

    await transporter.sendMail({
        from: config.from,
        to: String(recipientEmail),
        subject: `NeoList | ${args.title}`,
        text: args.body
    })

    await markDeliveryStatus({ deliveryId: args.deliveryId, status: 'SENT' })
}

export async function processPendingNotificationDeliveries(batchSize = 50) {
    const rows = await executeQuery(
        `SELECT d.id, d.event_id, d.user_id, d.channel, d.retry_count,
                e.event_type, e.task_id, e.payload
         FROM notif_deliveries d
         JOIN notif_events e ON e.id = d.event_id
         WHERE d.status = 'PENDING'
         ORDER BY d.created_at ASC
         FETCH FIRST ${Number(batchSize)} ROWS ONLY`
    )

    let processed = 0

    for (const row of rows || []) {
        const deliveryId = String(row.id || row.ID)
        const eventId = String(row.event_id || row.EVENT_ID)
        const userId = String(row.user_id || row.USER_ID)
        const channel = String(row.channel || row.CHANNEL) as NotificationChannel
        const retryCount = Number(row.retry_count || row.RETRY_COUNT || 0)
        const eventType = String(row.event_type || row.EVENT_TYPE) as NotificationEventType
        const taskId = String(row.task_id || row.TASK_ID || '') || null
        const payload = parseJson(row.payload || row.PAYLOAD)

        if (retryCount >= 3) {
            await markDeliveryStatus({
                deliveryId,
                status: 'FAILED',
                lastError: 'Retry limit reached'
            })
            continue
        }

        const lock = await executeNonQuery(
            `UPDATE notif_deliveries
             SET status = 'PROCESSING', updated_at = SYSTIMESTAMP
             WHERE id = :id AND status = 'PENDING'`,
            { id: deliveryId }
        )

        if (!lock || lock.rowsAffected === 0) {
            continue
        }

        try {
            const taskContext = await getTaskContext(taskId)
            const content = buildNotificationContent({
                eventType,
                taskContext,
                payload
            })

            if (channel === 'in_app') {
                await deliverInApp({
                    deliveryId,
                    userId,
                    eventId,
                    title: content.title,
                    body: content.body
                })
            } else if (channel === 'telegram') {
                await deliverTelegram({
                    deliveryId,
                    userId,
                    title: content.title,
                    body: content.body
                })
            } else if (channel === 'email') {
                await deliverEmail({
                    deliveryId,
                    userId,
                    title: content.title,
                    body: content.body
                })
            } else {
                await markDeliveryStatus({
                    deliveryId,
                    status: 'SKIPPED',
                    lastError: `Unsupported channel: ${channel}`
                })
            }

            processed += 1
        } catch (error: any) {
            await markDeliveryStatus({
                deliveryId,
                status: 'FAILED',
                lastError: String(error?.message || 'Unknown notification delivery error')
            })
        }
    }

    return processed
}
