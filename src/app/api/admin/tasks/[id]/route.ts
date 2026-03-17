import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { auth } from '@/auth'
import { deleteZimbraTaskViaAdminAPI } from '@/lib/zimbra-sync'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin/superadmin role
        const adminProfile = await executeQuery(
            `SELECT role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        if (!adminProfile?.[0] || (adminProfile[0].role !== 'admin' && adminProfile[0].role !== 'superadmin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { assignee_id, is_completed } = body

        if (assignee_id && typeof is_completed === 'boolean') {
            // Update task assignee completion status
            await executeNonQuery(
                `UPDATE task_assignees SET is_completed = :is_completed WHERE task_id = :task_id AND user_id = :user_id`,
                {
                    is_completed: is_completed ? 1 : 0,
                    task_id: id,
                    user_id: assignee_id
                }
            )

            // Update main task if all assignees completed
            const incompletedCount = await executeQuery(
                `SELECT COUNT(*) as cnt FROM task_assignees WHERE task_id = :task_id AND is_completed = 0`,
                { task_id: id }
            )

            if (incompletedCount?.[0]?.cnt === 0) {
                await executeNonQuery(
                    `UPDATE tasks SET is_completed = 1 WHERE id = :id`,
                    { id }
                )
            } else {
                await executeNonQuery(
                    `UPDATE tasks SET is_completed = 0 WHERE id = :id`,
                    { id }
                )
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Update task error:', error)
        // Don't expose internal error details for security
        return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin/superadmin role
        const adminProfile = await executeQuery(
            `SELECT role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        if (!adminProfile?.[0] || (adminProfile[0].role !== 'admin' && adminProfile[0].role !== 'superadmin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Fetch linked Zimbra task IDs before deleting local assignments
        const syncedAssignees = await executeQuery(
            `SELECT ta.zimbra_task_id, p.email, p.zimbra_sync_enabled
             FROM task_assignees ta
             JOIN profiles p ON p.id = ta.user_id
             WHERE ta.task_id = :task_id
               AND ta.zimbra_task_id IS NOT NULL`,
            { task_id: id }
        )

        // Try immediate remote delete; fallback to queue if remote API fails
        for (const row of syncedAssignees || []) {
            const zimbraTaskId = row.zimbra_task_id || row.ZIMBRA_TASK_ID
            const email = row.email || row.EMAIL
            const syncEnabled = Number(row.zimbra_sync_enabled ?? row.ZIMBRA_SYNC_ENABLED ?? 0) === 1

            if (!zimbraTaskId || !email || !syncEnabled) continue

            try {
                await deleteZimbraTaskViaAdminAPI(String(email), String(zimbraTaskId))
            } catch (remoteDeleteErr) {
                console.error('Admin delete: immediate Zimbra delete failed, queueing fallback', remoteDeleteErr)
                try {
                    const payload = JSON.stringify({
                        zimbra_task_id: String(zimbraTaskId),
                        email: String(email)
                    })
                    await executeNonQuery(
                        `INSERT INTO sync_queue (id, task_id, user_email, action_type, payload, status)
                         VALUES (SYS_GUID(), :tid, :uemail, 'DELETE', :payload, 'PENDING')`,
                        { tid: id, uemail: String(email), payload }
                    )
                } catch (queueErr) {
                    console.error('Admin delete: fallback queue insert failed', queueErr)
                }
            }
        }

        await executeNonQuery(
            `DELETE FROM task_assignees WHERE task_id = :id`,
            { id }
        )

        await executeNonQuery(
            `DELETE FROM tasks WHERE id = :id`,
            { id }
        )

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Delete task error:', error)
        // Don't expose internal error details for security
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }
}
