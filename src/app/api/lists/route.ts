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

        let sql = `
            SELECT l.id, l.title, l.folder_id, l.created_at, l.updated_at,
                   (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id) as task_count
            FROM lists l
        `

        const params: any = {}

        if (folderId) {
            sql += ' WHERE l.folder_id = :folder_id'
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
