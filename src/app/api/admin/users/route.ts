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
            `SELECT role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        if (!adminProfile?.[0] || (adminProfile[0].role !== 'admin' && adminProfile[0].role !== 'superadmin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // VPD Bypass: Not passing userId to executeQuery() allows admins to see all users
        // This is safe because we've already verified admin role above
        // Get all users with task counts
        const users = await executeQuery(`
            SELECT 
                p.id,
                p.email,
                p.full_name,
                p.role,
                p.branch,
                p.department,
                p.job_title,
                p.phone,
                p.manager_id,
                p.meeting_type,
                p.is_profile_complete,
                p.created_at,
                COUNT(DISTINCT ta.task_id) as task_count
            FROM profiles p
            LEFT JOIN task_assignees ta ON p.id = ta.user_id
            GROUP BY p.id, p.email, p.full_name, p.role, p.branch, p.department, 
                     p.job_title, p.phone, p.manager_id, p.meeting_type, p.is_profile_complete, p.created_at
            ORDER BY p.created_at DESC
        `)

        return NextResponse.json(users || [])
    } catch (error: any) {
        console.error('Get users error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
