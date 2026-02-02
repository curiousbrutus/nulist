import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/folder-members - Folder üyelerini listele
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const folderId = searchParams.get('folder_id')

        if (!folderId) {
            return NextResponse.json(
                { error: 'folder_id is required' },
                { status: 400 }
            )
        }

        const members = await executeQuery(
            `SELECT fm.id, fm.folder_id, fm.user_id, fm.role, fm.created_at,
                    fm.can_add_task, fm.can_assign_task, fm.can_delete_task, fm.can_add_list,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url
             FROM folder_members fm
             JOIN profiles p ON fm.user_id = p.id
             WHERE fm.folder_id = :folder_id
             ORDER BY fm.created_at DESC`,
            { folder_id: folderId },
            session.user.id
        )

        // Profile verisini nested object olarak düzenle
        const formatted = members.map((m: any) => {
            const normalized: any = {}
            for (const key in m) {
                normalized[key.toLowerCase()] = m[key]
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

        return NextResponse.json(formatted)
    } catch (error: any) {
        console.error('GET /api/folder-members error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// POST /api/folder-members - Folder'a üye ekle
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { folder_id, user_id, role, can_add_task, can_assign_task, can_delete_task, can_add_list } = body

        if (!folder_id || !user_id) {
            return NextResponse.json(
                { error: 'folder_id and user_id are required' },
                { status: 400 }
            )
        }

        const newId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await executeNonQuery(
            `INSERT INTO folder_members (id, folder_id, user_id, role, can_add_task, can_assign_task, can_delete_task, can_add_list)
             VALUES (:id, :folder_id, :user_id, :role, :can_add_task, :can_assign_task, :can_delete_task, :can_add_list)`,
            {
                id: newId,
                folder_id,
                user_id,
                role: role || 'member',
                can_add_task: can_add_task !== undefined ? (can_add_task ? 1 : 0) : 1,
                can_assign_task: can_assign_task !== undefined ? (can_assign_task ? 1 : 0) : 1,
                can_delete_task: can_delete_task !== undefined ? (can_delete_task ? 1 : 0) : 0,
                can_add_list: can_add_list !== undefined ? (can_add_list ? 1 : 0) : 0
            },
            session.user.id
        )

        const members = await executeQuery(
            `SELECT fm.id, fm.folder_id, fm.user_id, fm.role, fm.created_at,
                    fm.can_add_task, fm.can_assign_task, fm.can_delete_task, fm.can_add_list,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url
             FROM folder_members fm
             JOIN profiles p ON fm.user_id = p.id
             WHERE fm.id = :id`,
            { id: newId },
            session.user.id
        )

        const member = members[0]
        if (member) {
            const normalized: any = {}
            for (const key in member) {
                normalized[key.toLowerCase()] = member[key]
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
            return NextResponse.json(result, { status: 201 })
        }

        return NextResponse.json({ error: 'Member not found after creation' }, { status: 500 })
    } catch (error: any) {
        console.error('POST /api/folder-members error:', error)
        
        // Unique constraint hatası kontrolü
        if (error.message?.includes('unique') || error.message?.includes('ORA-00001')) {
            return NextResponse.json(
                { error: 'Bu kullanıcı zaten bu departmanda bulunuyor' },
                { status: 409 }
            )
        }
        
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
