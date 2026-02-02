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

        // Kullanıcının sahibi olduğu veya üyesi olduğu folder'ların tüm üyelerini getir
        const members = await executeQuery(
            `SELECT fm.id, fm.folder_id, fm.user_id, fm.role, fm.created_at,
                    fm.can_add_task, fm.can_assign_task, fm.can_delete_task, fm.can_add_list,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url, p.department as profile_department
             FROM folder_members fm
             JOIN profiles p ON fm.user_id = p.id
             WHERE fm.folder_id IN (
                 SELECT id FROM folders WHERE user_id = :user_id
                 UNION
                 SELECT folder_id FROM folder_members WHERE user_id = :user_id
             )
             ORDER BY fm.created_at DESC`,
            { user_id: session.user.id },
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
