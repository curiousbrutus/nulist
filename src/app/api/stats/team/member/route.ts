import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/oracle'
import { auth } from '@/auth'
import { requireManagerRole } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Yönetici rolü gerekli
    const access = await requireManagerRole(session.user.id)
    if (!access.allowed) {
        return NextResponse.json({ error: access.reason }, { status: 403 })
    }

    let connection
    try {
        const { searchParams } = new URL(request.url)
        const userId = (searchParams.get('user_id') || '').trim()
        const meetingType = (searchParams.get('meeting_type') || '').trim() || null

        if (!userId) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
        }

        connection = await getConnection()

        const rows = await connection.execute(
            `SELECT t.id,
                    t.title,
                    t.is_completed,
                    t.due_date,
                    NVL(t.meeting_type, 'Genel') AS meeting_type,
                    l.title AS list_title,
                    f.title AS folder_title
             FROM task_assignees ta
             JOIN tasks t ON t.id = ta.task_id
             LEFT JOIN lists l ON l.id = t.list_id
             LEFT JOIN folders f ON f.id = l.folder_id
             WHERE ta.user_id = :user_id
               AND (:meeting_type IS NULL OR NVL(t.meeting_type, 'Genel') = :meeting_type)
             ORDER BY t.is_completed ASC, t.due_date ASC NULLS LAST, t.created_at DESC`,
            {
                user_id: userId,
                meeting_type: meetingType
            }
        )

        const tasks = (rows.rows || []).map((row: any) => ({
            id: row[0],
            title: row[1],
            is_completed: Number(row[2]) === 1,
            due_date: row[3],
            meeting_type: row[4],
            list_title: row[5],
            folder_title: row[6]
        }))

        return NextResponse.json({ tasks })
    } catch (error: any) {
        console.error('GET /api/stats/team/member error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    } finally {
        if (connection) {
            await connection.close()
        }
    }
}
