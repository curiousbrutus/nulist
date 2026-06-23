import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { buildTaskVisibility, getUserRoleAndBranch } from '@/lib/auth-guard'

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

function normalizeRecurrenceMode(mode: any): 'fixed_schedule' | 'completion_driven' | null {
    if (mode === 'fixed_schedule' || mode === 'completion_driven') {
        return mode
    }
    return null
}

function normalizeRecurrenceEnabled(enabled: any): number {
    return enabled ? 1 : 0
}

function normalizeRecurrenceIntervalDays(interval: any): number | null {
    if (interval === undefined || interval === null || interval === '') return null
    const parsed = Number(interval)
    if (!Number.isFinite(parsed) || parsed < 1) return null
    return Math.floor(parsed)
}

// GET /api/tasks - Tasks listele (sadece kullanıcının görebildiği görevler)
export async function GET(request: NextRequest) {
    console.log(`[DEBUG] GET /api/tasks triggered at ${new Date().toISOString()}`)
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const listId = searchParams.get('list_id')

        // TEK YETKİ KAYNAĞI: görünürlük filtresi auth-guard'dan gelir (liste = detay = aynı mantık)
        const { role, branch } = await getUserRoleAndBranch(session.user.id)
        const vis = buildTaskVisibility(role, session.user.id, branch)

        let sql = `
            SELECT t.*,
                   (SELECT COUNT(*) FROM task_assignees ta WHERE ta.task_id = t.id) as assignee_count,
                   (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
            FROM tasks t
            WHERE ${vis.clause}
        `

        const params: any = { ...vis.params }

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
        const {
            title,
            list_id,
            description,
            due_date,
            priority,
            status,
            recurrence_enabled,
            recurrence_mode,
            recurrence_interval_days,
            recurrence_parent_task_id
        } = body

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

        const roleRows = await executeQuery(
            `SELECT role FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )
        const role = String(roleRows[0]?.role || roleRows[0]?.ROLE || '')

        const accessRows = await executeQuery(
            `SELECT l.id
             FROM lists l
             JOIN folders f ON l.folder_id = f.id
             LEFT JOIN folders pf ON pf.id = f.parent_id
             LEFT JOIN folder_members fm ON fm.folder_id = f.id AND fm.user_id = :user_id
             WHERE l.id = :list_id
               AND (
                    :is_privileged = 1
                    OR f.user_id = :user_id
                    OR NVL(fm.can_add_task, 0) = 1
                    OR NVL(fm.can_assign_task, 0) = 1
                    OR NVL(fm.can_delete_task, 0) = 1
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
               )`,
            {
                user_id: session.user.id,
                list_id,
                is_privileged: (role === 'admin' || role === 'superadmin') ? 1 : 0
            },
            session.user.id
        )

        if (!accessRows || accessRows.length === 0) {
            return NextResponse.json({ error: 'Bu listeye görev ekleme yetkiniz yok' }, { status: 403 })
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
            is_completed: 0,
            recurrence_enabled: normalizeRecurrenceEnabled(recurrence_enabled),
            recurrence_mode: normalizeRecurrenceMode(recurrence_mode),
            recurrence_interval_days: normalizeRecurrenceIntervalDays(recurrence_interval_days),
            recurrence_parent_task_id: recurrence_parent_task_id || null
        }

        if (params.recurrence_enabled === 1 && !params.recurrence_mode) {
            return NextResponse.json(
                { error: 'recurrence_mode is required when recurrence_enabled is true' },
                { status: 400 }
            )
        }

        if (params.recurrence_enabled === 1 && !params.recurrence_interval_days) {
            return NextResponse.json(
                { error: 'recurrence_interval_days is required when recurrence_enabled is true' },
                { status: 400 }
            )
        }

        const sql = `INSERT INTO tasks (
                    id, list_id, title, notes, due_date, priority, created_by, is_completed,
                    recurrence_enabled, recurrence_mode, recurrence_interval_days, recurrence_parent_task_id
                )
               VALUES (
                    :id, :list_id, :title, :notes, :due_date, :priority, :created_by, :is_completed,
                    :recurrence_enabled, :recurrence_mode, :recurrence_interval_days, :recurrence_parent_task_id
                )`

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
