import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/folders - Kullanıcının erişebildiği folder'ları listele
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const folders = await executeQuery(
            `SELECT f.id, f.title, f.user_id, f.parent_id, f.created_at,
                    (SELECT COUNT(*) FROM folder_members fm WHERE fm.folder_id = f.id) as member_count
             FROM folders f
             ORDER BY f.created_at DESC`,
            {},
            session.user.id
        )

        return NextResponse.json(folders)
    } catch (error: any) {
        console.error('GET /api/folders error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
            { status: 500 }
        )
    }
}

// POST /api/folders - Yeni folder oluştur
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { title, parent_id } = body

        if (!title || typeof title !== 'string') {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            )
        }

        // Yeni ID oluştur
        const newId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Folder oluştur
        await executeNonQuery(
            `INSERT INTO folders (id, title, user_id, parent_id)
             VALUES (:id, :title, :user_id, :parent_id)`,
            {
                id: newId,
                title: title,
                user_id: session.user.id,
                parent_id: parent_id || null
            },
            session.user.id
        )

        // Oluşturanı otomatik olarak admin olarak ekle
        await executeNonQuery(
            `INSERT INTO folder_members (id, folder_id, user_id, role)
             VALUES (:id, :folder_id, :user_id, 'admin')`,
            {
                id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                folder_id: newId,
                user_id: session.user.id
            },
            session.user.id
        )

        // Oluşturulan folder'ı getir
        const folders = await executeQuery(
            `SELECT * FROM folders WHERE id = :id`,
            { id: newId },
            session.user.id
        )

        return NextResponse.json(folders[0] || { id: newId, title }, { status: 201 })
    } catch (error: any) {
        console.error('POST /api/folders error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
            { status: 500 }
        )
    }
}
