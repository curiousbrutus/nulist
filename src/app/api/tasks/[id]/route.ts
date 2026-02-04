import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// Priority mapping: English (from UI) -> Turkish (for DB)
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
    return PRIORITY_TO_DB[priority] || priority
}

function normalizePriorityFromDB(task: any): any {
    if (task.priority || task.PRIORITY) {
        const p = task.priority || task.PRIORITY
        task.priority = PRIORITY_FROM_DB[p] || p
    }
    return task
}

// GET /api/tasks/[id] - Task detayı (assignees, comments, attachments ile)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Task bilgisi
        const tasks = await executeQuery(
            `SELECT * FROM tasks WHERE id = :id`,
            { id },
            session.user.id
        )

        if (tasks.length === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        const task = tasks[0]

        // Assignees (profile nested object olarak)
        const assigneesRaw = await executeQuery(
            `SELECT ta.task_id, ta.user_id, ta.is_completed, ta.assigned_at,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url, p.department as profile_department
             FROM task_assignees ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id = :task_id`,
            { task_id: id },
            session.user.id
        )

        const assignees = assigneesRaw.map((a: any) => {
            const result: any = {}
            // Önce tüm key'leri lowercase'e çevir
            const normalized: any = {}
            for (const key in a) {
                normalized[key.toLowerCase()] = a[key]
            }

            // Profile olmayan alanları kopyala
            for (const key in normalized) {
                if (key.startsWith('profile_')) continue
                result[key] = normalized[key]
            }

            // Profile objesini oluştur
            result.profile = {
                id: normalized.profile_id,
                email: normalized.profile_email,
                full_name: normalized.profile_full_name,
                avatar_url: normalized.profile_avatar_url,
                department: normalized.profile_department
            }
            return result
        })

        // Comments (profile nested object olarak)
        const commentsRaw = await executeQuery(
            `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url
             FROM comments c
             JOIN profiles p ON c.user_id = p.id
             WHERE c.task_id = :task_id
             ORDER BY c.created_at DESC`,
            { task_id: id },
            session.user.id
        )

        const comments = commentsRaw.map((c: any) => {
            const result: any = {}
            // Önce tüm key'leri lowercase'e çevir
            const normalized: any = {}
            for (const key in c) {
                normalized[key.toLowerCase()] = c[key]
            }

            // Profile olmayan alanları kopyala
            for (const key in normalized) {
                if (key.startsWith('profile_')) continue
                result[key] = normalized[key]
            }

            // Profile objesini oluştur
            result.profile = {
                id: normalized.profile_id,
                email: normalized.profile_email,
                full_name: normalized.profile_full_name,
                avatar_url: normalized.profile_avatar_url
            }
            return result
        })

        // Attachments (profile nested object olarak)
        const attachmentsRaw = await executeQuery(
            `SELECT ta.id, ta.task_id, ta.user_id, ta.file_name, ta.file_size, ta.file_type, ta.storage_path, ta.storage_type, ta.created_at,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name
             FROM task_attachments ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id = :task_id
             ORDER BY ta.created_at DESC`,
            { task_id: id },
            session.user.id
        )

        const attachments = attachmentsRaw.map((a: any) => {
            const normalized: any = {}
            for (const key in a) {
                normalized[key.toLowerCase()] = a[key]
            }
            const result: any = {}
            for (const key in normalized) {
                if (key.startsWith('profile_')) continue
                result[key] = normalized[key]
            }
            result.profile = {
                id: normalized.profile_id,
                email: normalized.profile_email,
                full_name: normalized.profile_full_name
            }
            return result
        })

        return NextResponse.json({
            ...normalizePriorityFromDB(task),
            task_assignees: assignees,
            comments,
            attachments
        })
    } catch (error: any) {
        console.error('GET /api/tasks/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// Priority mapping: English (from UI) -> Turkish (for DB)
const PRIORITY_MAP: Record<string, string> = {
    'low': 'Düşük',
    'medium': 'Orta',
    'high': 'Yüksek',
    'urgent': 'Acil',
    // Also accept Turkish values directly
    'Düşük': 'Düşük',
    'Orta': 'Orta',
    'Yüksek': 'Yüksek',
    'Acil': 'Acil'
}

// PUT /api/tasks/[id] - Task güncelle
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
        let { title, notes, due_date, priority, completed } = body

        console.log('PUT /api/tasks/[id] - Request body:', { title, notes, due_date, priority, completed })

        // Map priority from English to Turkish for DB
        if (priority !== undefined) {
            const originalPriority = priority
            priority = normalizePriorityForDB(priority)
            console.log(`Priority mapping: ${originalPriority} -> ${priority}`)
        }

        // Strict Permission Check: Only Assignees, Creator, Folder Owner, ADMIN, or SUPERADMIN can edit/close
        const permissionCheck = await executeQuery(
            `SELECT 1 as "access" FROM dual 
             WHERE EXISTS (
                 SELECT 1 FROM task_assignees WHERE task_id = :1 AND user_id = :2
             ) OR EXISTS (
                 SELECT 1 FROM tasks WHERE id = :1 AND created_by = :2
             ) OR EXISTS (
                 SELECT 1 FROM tasks t
                 JOIN lists l ON t.list_id = l.id
                 JOIN folders f ON l.folder_id = f.id
                 WHERE t.id = :1 AND f.user_id = :2
             ) OR EXISTS (
                 SELECT 1 FROM profiles WHERE id = :2 AND role IN ('admin', 'superadmin')
             )`,
            [resolvedParams.id, session.user.id]
        )

        if (permissionCheck.length === 0) {
            return NextResponse.json(
                { error: 'Bu görevi düzenleme veya kapatma yetkiniz yok. Sadece atanan kişiler veya yöneticiler işlem yapabilir.' },
                { status: 403 }
            )
        }

        // Build dynamic UPDATE query
        const updates: string[] = []
        const queryParams: any = {}

        if (title !== undefined) {
            updates.push('title = :title_val')
            queryParams.title_val = title
        }
        if (notes !== undefined) {
            updates.push('notes = :notes_val')
            queryParams.notes_val = notes
        }
        if (due_date !== undefined) {
            updates.push('due_date = :due_date_val')
            queryParams.due_date_val = due_date === null ? null : new Date(due_date)
        }
        if (priority !== undefined) {
            updates.push('priority = :priority_val')
            queryParams.priority_val = priority
        }
        if (completed !== undefined) {
            updates.push('is_completed = :is_completed_val')
            queryParams.is_completed_val = completed ? 1 : 0
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            )
        }

        const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = :id_val`
        queryParams.id_val = resolvedParams.id

        const result = await executeNonQuery(sql, queryParams, session.user.id)

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'Task not found or unauthorized' },
                { status: 404 }
            )
        }

        const tasks = await executeQuery(
            `SELECT * FROM tasks WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        return NextResponse.json(normalizePriorityFromDB(tasks[0]))
    } catch (error: any) {
        console.error('PUT /api/tasks/[id] error:', error)
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.errorNum,
            offset: error.offset
        })
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        )
    }
}

// DELETE /api/tasks/[id] - Task sil
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

        // Permission Check: Only Creator, Folder Owner, ADMIN, or SUPERADMIN can delete
        const permissionCheck = await executeQuery(
            `SELECT 1 as "access" FROM dual 
                 WHERE EXISTS (
                     SELECT 1 FROM tasks WHERE id = :1 AND created_by = :2
                 ) OR EXISTS (
                     SELECT 1 FROM tasks t
                     JOIN lists l ON t.list_id = l.id
                     JOIN folders f ON l.folder_id = f.id
                     WHERE t.id = :1 AND f.user_id = :2
                 ) OR EXISTS (
                     SELECT 1 FROM profiles WHERE id = :2 AND role IN ('admin', 'superadmin')
                 )`,
            [resolvedParams.id, session.user.id]
        )

        if (permissionCheck.length === 0) {
            return NextResponse.json(
                { error: 'Bu görevi silme yetkiniz yok. Sadece oluşturan, klasör sahibi veya yöneticiler silebilir.' },
                { status: 403 }
            )
        }

        const result = await executeNonQuery(
            `DELETE FROM tasks WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'Task not found or unauthorized' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/tasks/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
