import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// DELETE /api/task-assignees/[id] - Atamayı kaldır (id = user_id olarak kullanılıyor)
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

        // Query string'den task_id al
        const { searchParams } = new URL(request.url)
        const taskId = searchParams.get('task_id')

        if (!taskId) {
            return NextResponse.json(
                { error: 'task_id is required' },
                { status: 400 }
            )
        }

        // task_assignees tablosunda id kolonu yok, composite key kullanıyor (task_id + user_id)
        const result = await executeNonQuery(
            `DELETE FROM task_assignees WHERE task_id = :task_id AND user_id = :user_id`,
            { task_id: taskId, user_id: resolvedParams.id },
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'Assignment not found or unauthorized' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/task-assignees/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
