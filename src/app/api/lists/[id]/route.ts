import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery, executeTransaction } from '@/lib/oracle'

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

        const updates: string[] = ['updated_at = SYSTIMESTAMP']
        const queryParams: any = { id: resolvedParams.id }

        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim().length === 0) {
                return NextResponse.json(
                    { error: 'Title must be a non-empty string' },
                    { status: 400 }
                )
            }

            updates.push('title = :title')
            queryParams.title = title.trim()
        }

        if (folder_id !== undefined) {
            if (typeof folder_id !== 'string' || folder_id.trim().length === 0) {
                return NextResponse.json(
                    { error: 'folder_id must be a non-empty string' },
                    { status: 400 }
                )
            }

            updates.push('folder_id = :folder_id')
            queryParams.folder_id = folder_id.trim()
        }

        if (updates.length === 1) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            )
        }

        const result = await executeNonQuery(
            `UPDATE lists 
             SET ${updates.join(', ')}
             WHERE id = :id`,
            queryParams,
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

        const taskRows = await executeQuery<{ id: string }>(
            `SELECT id FROM tasks WHERE list_id = :list_id`,
            { list_id: resolvedParams.id },
            session.user.id
        )

        const taskIds = taskRows.map((row) => row.id)

        await executeTransaction(async (connection: any) => {
            if (taskIds.length > 0) {
                const placeholders = taskIds.map((_, index) => `:task_id_${index}`).join(', ')
                const bindParams: Record<string, any> = {}
                taskIds.forEach((taskId, index) => {
                    bindParams[`task_id_${index}`] = taskId
                })

                await connection.execute(
                    `UPDATE tasks
                     SET recurrence_parent_task_id = NULL
                     WHERE recurrence_parent_task_id IN (${placeholders})`,
                    bindParams,
                    { autoCommit: false }
                )

                await connection.execute(
                    `DELETE FROM sync_queue WHERE task_id IN (${placeholders})`,
                    bindParams,
                    { autoCommit: false }
                )
            }

            await connection.execute(
                `DELETE FROM tasks WHERE list_id = :list_id`,
                { list_id: resolvedParams.id },
                { autoCommit: false }
            )
        }, session.user.id)

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
