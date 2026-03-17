import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeNonQuery, executeQuery } from '@/lib/oracle'
import { deleteZimbraTaskViaAdminAPI } from '@/lib/zimbra-sync'

export const runtime = 'nodejs'

// PUT /api/task-assignees/[id] - Atanan kişinin tamamlanma durumunu güncelle
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const taskId = body?.task_id
        const isCompleted = body?.is_completed

        if (!taskId || typeof isCompleted !== 'boolean') {
            return NextResponse.json(
                { error: 'task_id and boolean is_completed are required' },
                { status: 400 }
            )
        }

        const assigneeUserId = resolvedParams.id

        const permission = await executeQuery(
            `SELECT 1
             FROM dual
             WHERE :current_user = :assignee_user
                OR EXISTS (
                    SELECT 1
                    FROM tasks t
                    JOIN lists l ON l.id = t.list_id
                    JOIN folders f ON f.id = l.folder_id
                    WHERE t.id = :task_id AND f.user_id = :current_user
                )
                OR EXISTS (
                    SELECT 1 FROM profiles WHERE id = :current_user AND role IN ('admin', 'superadmin')
                )`,
            {
                current_user: session.user.id,
                assignee_user: assigneeUserId,
                task_id: taskId
            },
            session.user.id
        )

        if (!permission || permission.length === 0) {
            return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
        }

        const result = await executeNonQuery(
            `UPDATE task_assignees
             SET is_completed = :is_completed
             WHERE task_id = :task_id AND user_id = :user_id`,
            {
                is_completed: isCompleted ? 1 : 0,
                task_id: taskId,
                user_id: assigneeUserId
            },
            session.user.id
        )

        if (!result || result.rowsAffected === 0) {
            return NextResponse.json({ error: 'Atama kaydı bulunamadı' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('PUT /api/task-assignees/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE /api/task-assignees/[id] - Atamayı kaldır (id = user_id olarak kullanılıyor)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Query string'den task_id al
        const { searchParams } = new URL(request.url)
        const taskId = searchParams.get('task_id')

        if (!taskId) {
            return NextResponse.json(
                { error: 'task_id is required' },
                { status: 400 }
            )
        }

        // Get Zimbra info before deletion
        const zimbraInfo = await executeQuery(
            `SELECT ta.zimbra_task_id, p.email, p.zimbra_sync_enabled
             FROM task_assignees ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id = :task_id AND ta.user_id = :user_id`,
             { task_id: taskId, user_id: resolvedParams.id },
             session.user.id
        )

        // task_assignees tablosunda id kolonu yok, composite key kullanıyor (task_id + user_id)
        const result = await executeNonQuery(
            `DELETE FROM task_assignees WHERE task_id = :task_id AND user_id = :user_id`,
            { task_id: taskId, user_id: resolvedParams.id },
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'Assignment not found or unauthorized' },
                { status: 404 }
            )
        }

        // Remove from Zimbra if synced
        if (zimbraInfo.length > 0) {
            const info = zimbraInfo[0]
            if (info.ZIMBRA_TASK_ID || info.zimbra_task_id) {
                const zimbraId = info.ZIMBRA_TASK_ID || info.zimbra_task_id
                const email = info.EMAIL || info.email
                if (zimbraId && email) {
                    // Fire and forget
                    deleteZimbraTaskViaAdminAPI(email, zimbraId).catch(err => 
                        console.error('Failed to delete Zimbra task:', err)
                    )
                }
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/task-assignees/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
