import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// Priority mapping helpers
const PRIORITY_TO_DB: Record<string, string> = {
    'low': 'Düşük',
    'medium': 'Orta',
    'high': 'Yüksek',
    'urgent': 'Acil',
    'Düşük': 'Düşük',
    'Orta': 'Orta',
    'Yüksek': 'Yüksek',
    'Acil': 'Acil'
}

const PRIORITY_FROM_DB: Record<string, string> = {
    'Düşük': 'low',
    'Orta': 'medium',
    'Yüksek': 'high',
    'Acil': 'urgent'
}

function normalizePriorityForDB(priority: any): string {
    if (!priority) return 'Orta'
    return PRIORITY_TO_DB[priority] || 'Orta'
}

function normalizePriorityFromDB(priority: any): string {
    if (!priority) return 'medium'
    return PRIORITY_FROM_DB[priority] || 'medium'
}

// GET /api/tasks - Tasks listele (sadece kullanıcının görebildiği görevler)
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const listId = searchParams.get('list_id')

        // Kullanıcının görebileceği görevler:
        // 1. Kendisine atanan görevler (task_assignees üzerinden)
        // 2. Kendi oluşturduğu görevler (created_by)
        // 3. Üyesi olduğu folder'lardaki görevler (folder_members üzerinden)
        // 4. Sahip olduğu folder'lardaki görevler (folders.user_id)
        let sql = `
            SELECT t.*,
                   (SELECT COUNT(*) FROM task_assignees ta WHERE ta.task_id = t.id) as assignee_count,
                   (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
            FROM tasks t
            JOIN lists l ON t.list_id = l.id
            WHERE (
                -- Kendisine atanan görevler
                t.id IN (SELECT task_id FROM task_assignees WHERE user_id = :user_id)
                -- Kendi oluşturduğu görevler
                OR t.created_by = :user_id
                -- Üyesi olduğu folder'lardaki görevler
                OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
                -- Sahip olduğu folder'lardaki görevler
                OR l.folder_id IN (SELECT id FROM folders WHERE user_id = :user_id)
            )
        `

        const params: any = { user_id: session.user.id }

        if (listId) {
            sql += ' AND t.list_id = :list_id'
            params.list_id = listId
        }

        sql += ' ORDER BY t.created_at DESC'

        const tasks = await executeQuery(sql, params, session.user.id)

        return NextResponse.json(tasks)
    } catch (error: any) {
        console.error('GET /api/tasks error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// POST /api/tasks - Yeni task oluştur
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { title, list_id, description, due_date, priority, status } = body

        if (!title || typeof title !== 'string') {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            )
        }

        if (!list_id) {
            return NextResponse.json(
                { error: 'list_id is required' },
                { status: 400 }
            )
        }

        const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Due date varsa Date objesine çevir
        const dueDateValue = due_date ? new Date(due_date) : null

        // SQL ve params'ı dinamik oluştur
        const params: any = {
            id: newId,
            list_id,
            title,
            notes: description || null,
            priority: normalizePriorityForDB(priority),
            created_by: session.user.id,
            due_date: dueDateValue,
            is_completed: 0
        }

        const sql = `INSERT INTO tasks (id, list_id, title, notes, due_date, priority, created_by, is_completed)
               VALUES (:id, :list_id, :title, :notes, :due_date, :priority, :created_by, :is_completed)`

        await executeNonQuery(sql, params, session.user.id)

        const tasks = await executeQuery(
            `SELECT * FROM tasks WHERE id = :id`,
            { id: newId },
            session.user.id
        )

        return NextResponse.json(tasks[0], { status: 201 })
    } catch (error: any) {
        console.error('POST /api/tasks error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
