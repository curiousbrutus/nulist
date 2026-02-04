import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// PUT /api/folder-members/[id] - Üye rolünü veya yetkilerini güncelle
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
        const { role, can_add_task, can_assign_task, can_delete_task, can_add_list } = body

        // Dinamik olarak UPDATE query'si oluştur
        const updates: string[] = []
        const queryParams: any = { id: resolvedParams.id }

        if (role !== undefined) {
            updates.push('role = :role_val')
            queryParams.role_val = role
        }
        if (can_add_task !== undefined) {
            updates.push('can_add_task = :can_add_task')
            queryParams.can_add_task = can_add_task ? 1 : 0
        }
        if (can_assign_task !== undefined) {
            updates.push('can_assign_task = :can_assign_task')
            queryParams.can_assign_task = can_assign_task ? 1 : 0
        }
        if (can_delete_task !== undefined) {
            updates.push('can_delete_task = :can_delete_task')
            queryParams.can_delete_task = can_delete_task ? 1 : 0
        }
        if (can_add_list !== undefined) {
            updates.push('can_add_list = :can_add_list')
            queryParams.can_add_list = can_add_list ? 1 : 0
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            )
        }

        const result = await executeNonQuery(
            `UPDATE folder_members 
             SET ${updates.join(', ')}
             WHERE id = :id`,
            queryParams,
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'Member not found or unauthorized' },
                { status: 404 }
            )
        }

        const members = await executeQuery(
            `SELECT fm.id, fm.folder_id, fm.user_id, fm.role, fm.created_at,
                    fm.can_add_task, fm.can_assign_task, fm.can_delete_task, fm.can_add_list,
                    p.id as profile_id, p.email as profile_email, p.full_name as profile_full_name, p.avatar_url as profile_avatar_url
             FROM folder_members fm
             JOIN profiles p ON fm.user_id = p.id
             WHERE fm.id = :id`,
            { id: resolvedParams.id },
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
            return NextResponse.json(result)
        }

        return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    } catch (error: any) {
        console.error('PUT /api/folder-members/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE /api/folder-members/[id] - Üyeyi çıkar (id = user_id olarak kullanılıyor)
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

        // id parametresi aslında user_id olarak kullanılıyor (FolderMemberModal'dan)
        // Hem id hem de user_id ile silmeyi deneyelim
        const result = await executeNonQuery(
            `DELETE FROM folder_members WHERE id = :id OR user_id = :user_id`,
            { id: resolvedParams.id, user_id: resolvedParams.id },
            session.user.id
        )

        if (result.rowsAffected === 0) {
            return NextResponse.json(
                { error: 'Member not found or unauthorized' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/folder-members/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
