import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { LocalStorageService } from '@/lib/storage'

export const runtime = 'nodejs'

const storage = new LocalStorageService()

// DELETE /api/attachments/batch - Batch dosya silme
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { attachment_ids } = body

        if (!attachment_ids || !Array.isArray(attachment_ids) || attachment_ids.length === 0) {
            return NextResponse.json(
                { error: 'attachment_ids array is required' },
                { status: 400 }
            )
        }

        let deletedCount = 0

        // Her attachment için silme işlemi
        for (const id of attachment_ids) {
            try {
                // Önce attachment bilgisini al (fiziksel dosyayı silmek için path gerekli)
                const attachments = await executeQuery(
                    `SELECT id, storage_path FROM task_attachments WHERE id = :id`,
                    { id },
                    session.user.id
                )

                if (attachments.length > 0) {
                    const attachment = attachments[0] as any
                    const storagePath = attachment.STORAGE_PATH || attachment.storage_path

                    // Fiziksel dosyayı sil
                    if (storagePath) {
                        try {
                            await storage.delete(storagePath)
                        } catch (fileError) {
                            console.warn(`Fiziksel dosya silinemedi (${storagePath}):`, fileError)
                        }
                    }

                    // Database kaydını sil
                    await executeNonQuery(
                        `DELETE FROM task_attachments WHERE id = :id`,
                        { id },
                        session.user.id
                    )
                    deletedCount++
                }
            } catch (error) {
                console.error(`Error deleting attachment ${id}:`, error)
            }
        }

        return NextResponse.json({ success: true, deleted_count: deletedCount })
    } catch (error: any) {
        console.error('DELETE /api/attachments/batch error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
