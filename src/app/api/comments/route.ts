import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { createNotificationEvent } from '@/lib/notifications'

export const runtime = 'nodejs'

// POST /api/comments - Yeni yorum ekle
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { task_id, content } = body

        if (!task_id || !content) {
            return NextResponse.json(
                { error: 'task_id and content are required' },
                { status: 400 }
            )
        }

        const newId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await executeNonQuery(
            `INSERT INTO comments (id, task_id, user_id, content)
             VALUES (:id, :task_id, :user_id, :content)`,
            {
                id: newId,
                task_id,
                user_id: session.user.id,
                content
            },
            session.user.id
        )

        const comments = await executeQuery(
            `SELECT c.*, p.email, p.full_name, p.avatar_url
             FROM comments c
             JOIN profiles p ON c.user_id = p.id
             WHERE c.id = :id`,
            { id: newId },
            session.user.id
        )

        try {
            const recipientRows = await executeQuery(
                `SELECT DISTINCT ta.user_id
                 FROM task_assignees ta
                 WHERE ta.task_id = :task_id`,
                { task_id },
                session.user.id
            )

            const recipients = recipientRows
                .map((r: any) => String(r.user_id || r.USER_ID || ''))
                .filter((id: string) => Boolean(id) && id !== session.user.id)

            await createNotificationEvent({
                eventType: 'comment_added',
                taskId: task_id,
                actorUserId: session.user.id,
                recipientUserIds: recipients,
                payload: {
                    content: String(content).slice(0, 500)
                },
                dedupeSeed: `comment:${newId}`
            })
        } catch (notificationError) {
            console.error('Comment notification enqueue error (non-blocking):', notificationError)
        }

        return NextResponse.json(comments[0], { status: 201 })
    } catch (error: any) {
        console.error('POST /api/comments error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
