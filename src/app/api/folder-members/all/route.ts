import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/folder-members/all - Kullanıcının erişebildiği tüm folder members
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

        // Kullanıcının erişebildiği folder'ların tüm üyelerini getir
        const members = await executeQuery(
            `SELECT fm.id, fm.folder_id, fm.user_id, fm.role, fm.created_at,
                    fm.can_add_task, fm.can_assign_task, fm.can_delete_task, fm.can_add_list,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url, p.department as profile_department
             FROM folder_members fm
             JOIN folders f ON f.id = fm.folder_id
             LEFT JOIN folders pf ON pf.id = f.parent_id
             JOIN profiles p ON fm.user_id = p.id
             WHERE (
                 :is_privileged = 1
                 OR f.user_id = :user_id
                 OR fm.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
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
             ORDER BY fm.created_at DESC`,
            {
                user_id: session.user.id,
                is_privileged: (role === 'admin' || role === 'superadmin') ? 1 : 0
            },
            session.user.id
        )

        // Profile verisini nested object olarak düzenle
        // cleanOracleObject zaten çalıştı, sadece restructure edelim
        const formatted = members.map((m: any) => {
            // Önce tüm key'leri lowercase'e çevir
            const normalized: any = {}
            for (const key in m) {
                normalized[key.toLowerCase()] = m[key]
            }

            // Profile olmayan alanları kopyala
            const result: any = {}
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

        return NextResponse.json(formatted)
    } catch (error: any) {
        console.error('GET /api/folder-members/all error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
