import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// POST /api/task-assignees - Task'a kullanıcı ata
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { task_id, user_id } = body

        if (!task_id || !user_id) {
            return NextResponse.json(
                { error: 'task_id and user_id are required' },
                { status: 400 }
            )
        }

        // task_assignees tablosunda ID kolonu yok, composite key kullanıyor (task_id + user_id)
        await executeNonQuery(
            `INSERT INTO task_assignees (task_id, user_id, is_completed)
             VALUES (:task_id, :user_id, 0)`,
            {
                task_id,
                user_id
            },
            session.user.id
        )

        const assignees = await executeQuery(
            `SELECT ta.*, p.email, p.full_name, p.avatar_url
             FROM task_assignees ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id = :task_id AND ta.user_id = :user_id`,
            { task_id, user_id },
            session.user.id
        )

        return NextResponse.json(assignees[0], { status: 201 })
    } catch (error: any) {
        console.error('POST /api/task-assignees error:', error)
        
        // Duplicate key hatası
        if (error.message?.includes('ORA-00001') || error.message?.includes('benzersiz')) {
            return NextResponse.json(
                { error: 'Bu kullanıcı zaten bu göreve atanmış' },
                { status: 409 }
            )
        }
        
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
