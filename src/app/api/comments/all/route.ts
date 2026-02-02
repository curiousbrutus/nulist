import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/comments/all - Kullanıcının erişebildiği tüm comments
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Kullanıcının erişebildiği task'ların tüm comments'larını getir
        const commentsRaw = await executeQuery(
            `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url
             FROM comments c
             JOIN profiles p ON c.user_id = p.id
             WHERE c.task_id IN (
                 SELECT t.id FROM tasks t
                 JOIN lists l ON t.list_id = l.id
                 WHERE l.folder_id IN (
                     SELECT id FROM folders WHERE user_id = :user_id
                     UNION
                     SELECT folder_id FROM folder_members WHERE user_id = :user_id
                 )
             )
             ORDER BY c.created_at DESC`,
            { user_id: session.user.id },
            session.user.id
        )

        // Profile nested object olarak format et
        const comments = commentsRaw.map((c: any) => {
            const normalized: any = {}
            for (const key in c) {
                normalized[key.toLowerCase()] = c[key]
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

        return NextResponse.json(comments)
    } catch (error: any) {
        console.error('GET /api/comments/all error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
