import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { auth } from '@/auth'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        // Get feedback history
        const feedback = await executeQuery(`
            SELECT 
                c.id,
                c.content,
                c.created_at,
                p.full_name as author_name
            FROM comments c
            LEFT JOIN profiles p ON c.user_id = p.id
            WHERE c.task_id = :task_id
            ORDER BY c.created_at DESC
        `, { task_id: id })

        return NextResponse.json(feedback || [])
    } catch (error: any) {
        console.error('Get feedback error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get admin profile
        const adminProfile = await executeQuery(
            `SELECT id, role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        if (!adminProfile?.[0] || (adminProfile[0].role !== 'admin' && adminProfile[0].role !== 'superadmin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { content } = body

        if (!content || !content.trim()) {
            return NextResponse.json({ error: 'Content required' }, { status: 400 })
        }

        // Add feedback as comment
        const result = await executeNonQuery(
            `INSERT INTO comments (id, task_id, user_id, content, created_at)
             VALUES (SYS_GUID(), :task_id, :user_id, :content, SYSDATE)`,
            {
                task_id: id,
                user_id: adminProfile[0].id,
                content: content.trim()
            }
        )

        return NextResponse.json({ success: true, insertedRows: result })
    } catch (error: any) {
        console.error('Add feedback error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
