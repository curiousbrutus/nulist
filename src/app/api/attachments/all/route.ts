import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/attachments/all - Kullanıcının erişebildiği tüm attachments
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Kullanıcının erişebildiği task'ların tüm attachments'larını getir
        const attachmentsRaw = await executeQuery(
            `SELECT ta.id, ta.task_id, ta.user_id, ta.file_name, ta.file_size, ta.file_type, 
                    ta.storage_path, ta.storage_type, ta.created_at,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url
             FROM task_attachments ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id IN (
                 SELECT t.id FROM tasks t
                 JOIN lists l ON t.list_id = l.id
                 WHERE l.folder_id IN (
                     SELECT id FROM folders WHERE user_id = :user_id
                     UNION
                     SELECT folder_id FROM folder_members WHERE user_id = :user_id
                 )
             )
             ORDER BY ta.created_at DESC`,
            { user_id: session.user.id },
            session.user.id
        )

        // Profile nested object olarak format et
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
                full_name: normalized.profile_full_name,
                avatar_url: normalized.profile_avatar_url
            }
            return result
        })

        return NextResponse.json(attachments)
    } catch (error: any) {
        console.error('GET /api/attachments/all error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
