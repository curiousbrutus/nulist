import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { auth } from '@/auth'

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
        return NextResponse.json({ error: error.message }, { status: 500 })
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

        // Delete task and related data
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
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
