import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/lists/[id] - List detayı
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const lists = await executeQuery(
            `SELECT l.*, 
                    (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id) as task_count
             FROM lists l
             WHERE l.id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        if (lists.length === 0) {
            return NextResponse.json({ error: 'List not found' }, { status: 404 })
        }

        return NextResponse.json(lists[0])
    } catch (error: any) {
        console.error('GET /api/lists/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// PUT /api/lists/[id] - List güncelle
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params
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

        const result = await executeNonQuery(
            `UPDATE lists 
             SET title = :title, folder_id = :folder_id, updated_at = SYSTIMESTAMP
             WHERE id = :id`,
            { id: resolvedParams.id, title, folder_id: folder_id || null },
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'List not found or unauthorized' },
                { status: 404 }
            )
        }

        const lists = await executeQuery(
            `SELECT * FROM lists WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        return NextResponse.json(lists[0])
    } catch (error: any) {
        console.error('PUT /api/lists/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE /api/lists/[id] - List sil
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const result = await executeNonQuery(
            `DELETE FROM lists WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'List not found or unauthorized' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/lists/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
