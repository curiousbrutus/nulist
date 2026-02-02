import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// PUT /api/comments/[id] - Yorum güncelle
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
        const { content } = body

        if (!content) {
            return NextResponse.json(
                { error: 'content is required' },
                { status: 400 }
            )
        }

        const result = await executeNonQuery(
            `UPDATE comments 
             SET content = :content, updated_at = SYSTIMESTAMP
             WHERE id = :id AND user_id = :user_id`,
            { id: resolvedParams.id, content, user_id: session.user.id },
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'Comment not found or unauthorized' },
                { status: 404 }
            )
        }

        const comments = await executeQuery(
            `SELECT c.*, p.email, p.full_name, p.avatar_url
             FROM comments c
             JOIN profiles p ON c.user_id = p.id
             WHERE c.id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        return NextResponse.json(comments[0])
    } catch (error: any) {
        console.error('PUT /api/comments/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE /api/comments/[id] - Yorum sil
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
            `DELETE FROM comments WHERE id = :id AND user_id = :user_id`,
            { id: resolvedParams.id, user_id: session.user.id },
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'Comment not found or unauthorized' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/comments/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
