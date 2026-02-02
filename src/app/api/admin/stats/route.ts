import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/oracle'
import { auth } from '@/auth'

export async function GET(request: NextRequest) {
    try {
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

        // Get total users
        const userStats = await executeQuery(
            `SELECT COUNT(*) as total_users FROM profiles`
        )

        // Get active users (last 30 days)
        const activeStats = await executeQuery(
            `SELECT COUNT(DISTINCT user_id) as active_users 
             FROM task_assignees 
             WHERE assigned_at >= TRUNC(SYSDATE) - 30`
        )

        // Get task stats
        const taskStats = await executeQuery(
            `SELECT 
                COUNT(*) as total_tasks,
                SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END) as pending_tasks
             FROM tasks`
        )

        // Get average completion time
        const completionTimeStats = await executeQuery(
            `SELECT 
                ROUND(AVG(TRUNC(created_at) - TRUNC(SYSDATE)), 0) as avg_completion_days
             FROM tasks
             WHERE is_completed = 1`
        )

        const stats = {
            totalUsers: userStats?.[0]?.total_users || 0,
            activeUsers: activeStats?.[0]?.active_users || 0,
            totalTasks: taskStats?.[0]?.total_tasks || 0,
            completedTasks: taskStats?.[0]?.completed_tasks || 0,
            pendingTasks: taskStats?.[0]?.pending_tasks || 0,
            averageCompletionTime: `${Math.abs(completionTimeStats?.[0]?.avg_completion_days || 0).toFixed(1)}`
        }

        return NextResponse.json(stats)
    } catch (error: any) {
        console.error('Get stats error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
