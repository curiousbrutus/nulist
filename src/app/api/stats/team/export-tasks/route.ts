import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/oracle'
import { auth } from '@/auth'
import { requireManagerRole } from '@/lib/auth-guard'
import oracledb from 'oracledb'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Yönetici rolü gerekli (admin/superadmin/secretary)
    const access = await requireManagerRole(session.user.id)
    if (!access.allowed) {
        return NextResponse.json({ error: access.reason }, { status: 403 })
    }

    let connection
    try {
        const { searchParams } = new URL(request.url)
        const department = searchParams.get('department')
        const unit = searchParams.get('unit')
        const meetingType = searchParams.get('meeting_type')
        const userId = searchParams.get('user_id')

        connection = await getConnection()

        let query = `
            SELECT 
                t.id,
                t.title AS task_title,
                t.notes,
                t.is_completed,
                TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
                TO_CHAR(t.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
                t.priority,
                NVL(t.meeting_type, 'Genel') AS meeting_type,
                l.title AS list_title,
                f.title AS folder_title,
                p.full_name AS assignee_name,
                p.department AS assignee_department
            FROM tasks t
            LEFT JOIN lists l ON t.list_id = l.id
            LEFT JOIN folders f ON l.folder_id = f.id
            LEFT JOIN task_assignees ta ON t.id = ta.task_id
            LEFT JOIN profiles p ON ta.user_id = p.id
            WHERE 1=1
        `

        const params: Record<string, any> = {}

        if (department) {
            query += ` AND p.department = :department`
            params.department = department
        }
        if (unit) {
            query += ` AND l.title = :unit`
            params.unit = unit
        }
        if (meetingType) {
            query += ` AND NVL(t.meeting_type, 'Genel') = :meeting_type`
            params.meeting_type = meetingType
        }
        if (userId) {
            query += ` AND ta.user_id = :user_id`
            params.user_id = userId
        }

        query += ` ORDER BY t.created_at DESC`

        const result = await connection.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT })

        return NextResponse.json({ tasks: result.rows || [] })

    } catch (error: any) {
        console.error('Export Tasks Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    } finally {
        if (connection) {
            await connection.close()
        }
    }
}
