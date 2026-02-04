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
        const { new_assignee_id } = body

        if (!new_assignee_id) {
            return NextResponse.json({ error: 'new_assignee_id required' }, { status: 400 })
        }

        // Get current assignees
        const currentAssignees = await executeQuery(
            `SELECT user_id FROM task_assignees WHERE task_id = :task_id`,
            { task_id: id }
        )

        // Remove old assignees
        if (currentAssignees && currentAssignees.length > 0) {
            await executeNonQuery(
                `DELETE FROM task_assignees WHERE task_id = :task_id`,
                { task_id: id }
            )
        }

        // Add new assignee
        await executeNonQuery(
            `INSERT INTO task_assignees (task_id, user_id, is_completed, assigned_at)
             VALUES (:task_id, :user_id, 0, SYSDATE)`,
            {
                task_id: id,
                user_id: new_assignee_id
            }
        )

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Reassign task error:', error)
        // Don't expose internal error details for security
        return NextResponse.json({ error: 'Failed to reassign task' }, { status: 500 })
    }
}
