import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { LocalStorageService } from '@/lib/storage'

export const runtime = 'nodejs'

const storage = new LocalStorageService()

// GET /api/attachments/[id] - Dosya indir
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

        const attachments = await executeQuery(
            `SELECT * FROM task_attachments WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        if (attachments.length === 0) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
        }

        const attachment = attachments[0]
        const storagePath = attachment.STORAGE_PATH || attachment.storage_path
        const fileUrl = storage.getPublicUrl(storagePath)

        return NextResponse.json({ ...attachment, url: fileUrl })
    } catch (error: any) {
        console.error('GET /api/attachments/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE /api/attachments/[id] - Dosya sil
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

        // Attachment bilgisini al
        const attachments = await executeQuery(
            `SELECT * FROM task_attachments WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        if (attachments.length === 0) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
        }

        const attachment = attachments[0]

        // Oracle UPPERCASE döndürüyor, her iki durumu da kontrol et
        const storagePath = attachment.STORAGE_PATH || attachment.storage_path

        // Dosyayı sil (path varsa)
        if (storagePath) {
            try {
                await storage.delete(storagePath)
            } catch (fileError) {
                console.warn('Dosya silinemedi (zaten silinmiş olabilir):', fileError)
            }
        }

        // Database kaydını sil
        await executeNonQuery(
            `DELETE FROM task_attachments WHERE id = :id`,
            { id: resolvedParams.id },
            session.user.id
        )

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/attachments/[id] error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
