import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { auth } from '@/auth'
import { createZimbraTaskViaAdminAPI, updateZimbraTaskViaAdminAPI } from '@/lib/zimbra-sync'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin/superadmin role
        const adminProfile = await executeQuery(
            `SELECT role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        if (!adminProfile?.[0] || (adminProfile[0].role !== 'admin' && adminProfile[0].role !== 'superadmin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Fetch Task Details
        const taskDetails = await executeQuery(
            `SELECT title, notes, due_date, priority FROM tasks WHERE id = :id`,
            { id }
        )

        if (!taskDetails || taskDetails.length === 0) {
             return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }
        const task = taskDetails[0]

        // Fetch Assignees
        const assignees = await executeQuery(
            `SELECT ta.user_id, ta.zimbra_task_id, p.email, p.zimbra_sync_enabled
             FROM task_assignees ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id = :task_id`,
            { task_id: id }
        )

        const results = []

        for (const assignee of assignees) {
            const email = assignee.email || assignee.EMAIL
            const zimbraId = assignee.zimbra_task_id || assignee.ZIMBRA_TASK_ID
            const syncEnabled = assignee.zimbra_sync_enabled || assignee.ZIMBRA_SYNC_ENABLED

            if (!email) {
                results.push({ email: 'N/A', status: 'skipped', reason: 'No email' })
                continue
            }

            if (syncEnabled !== 1) {
                results.push({ email, status: 'skipped', reason: 'Sync disabled' })
                continue
            }

            try {
                if (zimbraId) {
                    // Update existing
                    console.log(`Manual Sync: Updating Zimbra task for ${email} (ID: ${zimbraId})`)
                    const updateRes = await updateZimbraTaskViaAdminAPI(
                        email,
                        zimbraId,
                        {
                            title: task.title || task.TITLE,
                            notes: task.notes || task.NOTES || '',
                            due_date: task.due_date || task.DUE_DATE,
                            priority: task.priority || task.PRIORITY
                        }
                    )
                    
                    if (updateRes.success) {
                        results.push({ email, status: 'updated' })
                    } else {
                        console.warn(`Manual Sync: Update failed for ${email} (ID: ${zimbraId}), retrying as create... Error: ${updateRes.error}`)
                        
                        // Fallback: Create new task if update fails (e.g. task deleted in Zimbra)
                        const createRes = await createZimbraTaskViaAdminAPI(
                            email,
                            {
                                title: task.title || task.TITLE,
                                notes: task.notes || task.NOTES || '',
                                due_date: task.due_date || task.DUE_DATE,
                                priority: task.priority || task.PRIORITY
                            }
                        )

                        if (createRes.success && createRes.taskId) {
                            await executeNonQuery(
                               `UPDATE task_assignees SET zimbra_task_id = :zid 
                                WHERE task_id = :tid AND user_id = :uid`,
                               { zid: createRes.taskId, tid: id, uid: assignee.user_id || assignee.USER_ID }
                            )
                            results.push({ email, status: 're-created', zimbraId: createRes.taskId, originalError: updateRes.error })
                        } else {
                            results.push({ email, status: 'failed', error: createRes.error || updateRes.error })
                        }
                    }
                } else {
                    // Create new
                    console.log(`Manual Sync: Creating Zimbra task for ${email}`)
                    const createRes = await createZimbraTaskViaAdminAPI(
                        email,
                        {
                            title: task.title || task.TITLE,
                            notes: task.notes || task.NOTES || '',
                            due_date: task.due_date || task.DUE_DATE,
                            priority: task.priority || task.PRIORITY
                        }
                    )

                    if (createRes.success && createRes.taskId) {
                        await executeNonQuery(
                           `UPDATE task_assignees SET zimbra_task_id = :zid 
                            WHERE task_id = :tid AND user_id = :uid`,
                           { zid: createRes.taskId, tid: id, uid: assignee.user_id || assignee.USER_ID }
                        )
                        results.push({ email, status: 'created', zimbraId: createRes.taskId })
                    } else {
                        results.push({ email, status: 'failed', error: createRes.error })
                    }
                }
            } catch (err: any) {
                console.error(`Sync error for ${email}:`, err)
                results.push({ email, status: 'error', error: err.message })
            }
        }

        return NextResponse.json({ success: true, results })

    } catch (error: any) {
        console.error('Manual sync task error:', error)
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
    }
}
