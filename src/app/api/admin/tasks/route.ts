import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { auth } from '@/auth'

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin/superadmin role
        const adminProfile = await executeQuery(
            `SELECT id, role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        if (!adminProfile?.[0] || (adminProfile[0].role !== 'admin' && adminProfile[0].role !== 'superadmin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // VPD Bypass: Not passing userId to executeQuery() allows admins to see all tasks
        // This is safe because we've already verified admin role above
        // Get all tasks with details
        const tasks = await executeQuery(`
            SELECT 
                t.id,
                t.list_id,
                t.title,
                t.notes,
                t.is_completed,
                t.priority,
                t.due_date,
                t.created_at,
                t.created_by,
                t.is_private,
                t.branch,
                t.meeting_type,
                l.title as list_title,
                f.title as folder_title,
                p.full_name as created_by_name
            FROM tasks t
            LEFT JOIN lists l ON t.list_id = l.id
            LEFT JOIN folders f ON l.folder_id = f.id
            LEFT JOIN profiles p ON t.created_by = p.id
            ORDER BY t.created_at DESC
        `)

        // Get assignees for each task
        const tasksWithAssignees = await Promise.all(
            (tasks || []).map(async (task: any) => {
                const assignees = await executeQuery(
                    `SELECT ta.user_id, ta.is_completed, p.full_name, p.email
                     FROM task_assignees ta
                     LEFT JOIN profiles p ON ta.user_id = p.id
                     WHERE ta.task_id = :task_id`,
                    { task_id: task.id }
                )
                return {
                    ...task,
                    assignees: assignees || []
                }
            })
        )

        return NextResponse.json(tasksWithAssignees)
    } catch (error: any) {
        console.error('Get tasks error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
