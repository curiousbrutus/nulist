import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { createZimbraTaskViaAdminAPI } from '@/lib/zimbra-sync'

export const runtime = 'nodejs'

// POST /api/task-assignees - Task'a kullanıcı ata
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { task_id, user_id } = body

        if (!task_id || !user_id) {
            return NextResponse.json(
                { error: 'task_id and user_id are required' },
                { status: 400 }
            )
        }

        // task_assignees tablosunda ID kolonu yok, composite key kullanıyor (task_id + user_id)
        await executeNonQuery(
            `INSERT INTO task_assignees (task_id, user_id, is_completed)
             VALUES (:task_id, :user_id, 0)`,
            {
                task_id,
                user_id
            },
            session.user.id
        )

        const assignees = await executeQuery(
            `SELECT ta.*, p.email, p.full_name, p.avatar_url, p.zimbra_sync_enabled
             FROM task_assignees ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id = :task_id AND ta.user_id = :user_id`,
            { task_id, user_id },
            session.user.id
        )

        const assignee = assignees[0]

        // Atanan kullanıcının Zimbra sync'i aktifse, görevi kuyruğa ekle (Queue)
        if (assignee && assignee.zimbra_sync_enabled === 1 && assignee.email) {
            try {
                // Task detaylarını al
                const taskDetails = await executeQuery(
                    `SELECT t.title, t.notes, t.due_date, t.priority
                     FROM tasks t
                     WHERE t.id = :task_id`,
                    { task_id },
                    session.user.id
                )

                if (taskDetails && taskDetails.length > 0) {
                    const task = taskDetails[0]
                    
                    // Kuyruğa ekle
                    const payload = JSON.stringify({
                        target_user_id: user_id, // Hangi kullanıcı için zimbra ID güncellenecek
                        email: assignee.email,
                        title: task.title || task.TITLE,
                        notes: task.notes || task.NOTES || '',
                        due_date: task.due_date || task.DUE_DATE,
                        priority: task.priority || task.PRIORITY || 'Orta'
                    })

                    await executeNonQuery(
                        `INSERT INTO sync_queue (id, task_id, user_email, action_type, payload, status)
                         VALUES (SYS_GUID(), :tid, :uemail, 'CREATE', :payload, 'PENDING')`,
                        { tid: task_id, uemail: assignee.email, payload },
                        session.user.id
                    )

                    console.log(`✓ Task ${task_id} queued for Zimbra creation for ${assignee.email}`)
                }
            } catch (zimbraError) {
                // Queue hatası ana akışı bozmasın
                console.error('Zimbra queue error (non-blocking):', zimbraError)
            }
        }

        return NextResponse.json(assignee, { status: 201 })
    } catch (error: any) {
        console.error('POST /api/task-assignees error:', error)
        
        // Duplicate key hatası
        if (error.message?.includes('ORA-00001') || error.message?.includes('benzersiz')) {
            return NextResponse.json(
                { error: 'Bu kullanıcı zaten bu göreve atanmış' },
                { status: 409 }
            )
        }
        
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
