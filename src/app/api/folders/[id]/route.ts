import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { checkFolderAccess } from '@/lib/auth-guard'

export const runtime = 'nodejs'

// GET /api/folders/[id] - Folder detayı
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Erişim kontrolü
        const access = await checkFolderAccess(resolvedParams.id, session.user.id)
        if (!access.allowed) {
            return NextResponse.json({ error: access.reason }, { status: 403 })
        }

        const folders = await executeQuery(
            `SELECT f.*, 
                    (SELECT COUNT(*) FROM folder_members fm WHERE fm.folder_id = f.id) as member_count,
                    (SELECT COUNT(*) FROM lists l WHERE l.folder_id = f.id) as list_count
             FROM folders f
             WHERE f.id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        if (folders.length === 0) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
        }

        return NextResponse.json(folders[0])
    } catch (error: any) {
        console.error('GET /api/folders/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// PUT /api/folders/[id] - Folder güncelle
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

        // Erişim kontrolü
        const access = await checkFolderAccess(resolvedParams.id, session.user.id)
        if (!access.allowed) {
            return NextResponse.json({ error: access.reason }, { status: 403 })
        }

        const body = await request.json()
        const { title } = body

        if (!title || typeof title !== 'string') {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            )
        }

        const result = await executeNonQuery(
            `UPDATE folders 
             SET title = :title, updated_at = SYSTIMESTAMP
             WHERE id = :id`,
            { id: resolvedParams.id, title },
            session.user.id
        )

        if (!result?.rowsAffected) {
            return NextResponse.json(
                { error: 'Folder not found or unauthorized' },
                { status: 404 }
            )
        }

        // Güncellenmiş folder'ı getir
        const folders = await executeQuery(
            `SELECT * FROM folders WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        return NextResponse.json(folders[0])
    } catch (error: any) {
        console.error('PUT /api/folders/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE /api/folders/[id] - Folder sil
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

        // Erişim kontrolü
        const access = await checkFolderAccess(resolvedParams.id, session.user.id)
        if (!access.allowed) {
            return NextResponse.json({ error: access.reason }, { status: 403 })
        }

        const folderRows = await executeQuery(
            `SELECT id, parent_id FROM folders WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        if (folderRows.length === 0) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
        }

        const roleRows = await executeQuery(
            `SELECT role FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )

        const role = roleRows[0]?.role || roleRows[0]?.ROLE
        const isAdmin = role === 'admin' || role === 'superadmin'
        const parentId = folderRows[0]?.parent_id || folderRows[0]?.PARENT_ID

        if (!parentId && !isAdmin) {
            return NextResponse.json(
                { error: 'Sadece admin/superadmin departman silebilir.' },
                { status: 403 }
            )
        }

        // Cascade delete - önce ilişkili kayıtları sil
        await executeNonQuery(
            `DELETE FROM folder_members WHERE folder_id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        // Delete lists within folder
        await executeNonQuery(
            `DELETE FROM lists WHERE folder_id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        const result = await executeNonQuery(
            `DELETE FROM folders WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        if (!result?.rowsAffected) {
            return NextResponse.json(
                { error: 'Folder not found or unauthorized' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/folders/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
