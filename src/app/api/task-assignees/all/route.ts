import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/task-assignees/all - Kullanıcının erişebildiği tüm task assignees
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Kullanıcının erişebildiği task'ların tüm assignees'larını getir
        const assigneesRaw = await executeQuery(
            `SELECT ta.task_id, ta.user_id, ta.is_completed, ta.assigned_at,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url, p.department as profile_department
             FROM task_assignees ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id IN (
                 SELECT t.id FROM tasks t
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
             )
             ORDER BY ta.assigned_at DESC`,
            { user_id: session.user.id },
            session.user.id
        )

        // Profile nested object olarak format et
        const assignees = assigneesRaw.map((a: any) => {
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
                full_name: normalized.profile_full_name,
                avatar_url: normalized.profile_avatar_url,
                department: normalized.profile_department
            }
            return result
        })

        return NextResponse.json(assignees)
    } catch (error: any) {
        console.error('GET /api/task-assignees/all error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
