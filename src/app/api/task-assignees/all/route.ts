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

        const roleRows = await executeQuery(
            `SELECT role FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )
        const role = String(roleRows[0]?.role || roleRows[0]?.ROLE || '')

        // Kullanıcının erişebildiği task'ların tüm assignees'larını getir
        const assigneesRaw = await executeQuery(
            `SELECT ta.task_id, ta.user_id, ta.is_completed, ta.assigned_at,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url, p.department as profile_department
             FROM task_assignees ta
             JOIN tasks t ON t.id = ta.task_id
             JOIN lists l ON t.list_id = l.id
             JOIN folders f ON f.id = l.folder_id
             LEFT JOIN folders pf ON pf.id = f.parent_id
             JOIN profiles p ON ta.user_id = p.id
             WHERE (
                :is_privileged = 1
                OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = :user_id)
                OR t.created_by = :user_id
                OR f.user_id = :user_id
                OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
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
             )
             ORDER BY ta.assigned_at DESC`,
            {
                user_id: session.user.id,
                is_privileged: (role === 'admin' || role === 'superadmin') ? 1 : 0
            },
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
