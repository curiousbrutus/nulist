import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/lists - Lists listele
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const folderId = searchParams.get('folder_id')

        const roleRows = await executeQuery(
            `SELECT role FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )
        const role = String(roleRows[0]?.role || roleRows[0]?.ROLE || '')

        let sql = `
            SELECT l.id, l.title, l.folder_id, l.created_at, l.updated_at,
                   (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id) as task_count
            FROM lists l
            JOIN folders f ON f.id = l.folder_id
            LEFT JOIN folders pf ON pf.id = f.parent_id
        `

        const params: any = {
            user_id: session.user.id,
            is_privileged: (role === 'admin' || role === 'superadmin') ? 1 : 0
        }

        sql += `
            WHERE (
                :is_privileged = 1
                OR f.user_id = :user_id
                OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
                OR EXISTS (
                    SELECT 1
                    FROM user_departments ud
                    JOIN departments d ON d.id = ud.department_id
                    JOIN facilities fac ON fac.id = d.facility_id
                    WHERE ud.user_id = :user_id
                      AND (
                        UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                        OR UPPER(TRIM(NVL(pf.title, ''))) = UPPER(TRIM(d.name))
                      )
                      AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
                )
            )
        `

        if (folderId) {
            sql += ' AND l.folder_id = :folder_id'
            params.folder_id = folderId
        }

        sql += ' ORDER BY l.created_at DESC'

        const lists = await executeQuery(sql, params, session.user.id)

        return NextResponse.json(lists)
    } catch (error: any) {
        console.error('GET /api/lists error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// POST /api/lists - Yeni list oluştur
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { title, folder_id } = body

        if (!title || typeof title !== 'string') {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            )
        }

        const newId = `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await executeNonQuery(
            `INSERT INTO lists (id, title, folder_id)
             VALUES (:id, :title, :folder_id)`,
            {
                id: newId,
                title: title,
                folder_id: folder_id || null
            },
            session.user.id
        )

        const lists = await executeQuery(
            `SELECT * FROM lists WHERE id = :id`,
            { id: newId },
            session.user.id
        )

        return NextResponse.json(lists[0], { status: 201 })
    } catch (error: any) {
        console.error('POST /api/lists error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
