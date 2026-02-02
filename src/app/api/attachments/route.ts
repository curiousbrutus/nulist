import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { generateUniqueFileName, isFileTypeAllowed, isFileSizeAllowed, getMaxFileSize, LocalStorageService } from '@/lib/storage'

export const runtime = 'nodejs'

const storage = new LocalStorageService()

// POST /api/attachments - Dosya yükle
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const taskId = formData.get('task_id') as string

        if (!file || !taskId) {
            return NextResponse.json(
                { error: 'file and task_id are required' },
                { status: 400 }
            )
        }

        // Dosya validasyonu
        if (!isFileTypeAllowed(file.type)) {
            return NextResponse.json(
                { error: 'File type not allowed' },
                { status: 400 }
            )
        }

        if (!isFileSizeAllowed(file.size)) {
            return NextResponse.json(
                { error: `File size exceeds ${getMaxFileSize() / 1024 / 1024}MB limit` },
                { status: 400 }
            )
        }

        // Dosya adı oluştur
        const fileName = generateUniqueFileName(file.name)
        const filePath = `tasks/${taskId}/${fileName}`

        // Local storage'a yükle
        await storage.upload(file, filePath)

        // Database kaydı
        const newId = `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // task_attachments tablosunda uploaded_by değil user_id var
        await executeNonQuery(
            `INSERT INTO task_attachments (id, task_id, user_id, file_name, storage_path, file_size, file_type, storage_type)
             VALUES (:id, :task_id, :user_id, :file_name, :storage_path, :file_size, :file_type, :storage_type)`,
            {
                id: newId,
                task_id: taskId,
                user_id: session.user.id,
                file_name: file.name,
                storage_path: filePath,
                file_size: file.size,
                file_type: file.type,
                storage_type: 'local'
            },
            session.user.id
        )

        const attachments = await executeQuery(
            `SELECT * FROM task_attachments WHERE id = :id`,
            { id: newId },
            session.user.id
        )

        return NextResponse.json(attachments[0], { status: 201 })
    } catch (error: any) {
        console.error('POST /api/attachments error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
