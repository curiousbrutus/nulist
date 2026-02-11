import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { auth } from '@/auth'
import { createZimbraTaskViaAdminAPI, deleteZimbraTaskViaAdminAPI } from '@/lib/zimbra-sync'

export async function PUT(
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

        const body = await request.json()
        const { new_assignee_id } = body

        if (!new_assignee_id) {
            return NextResponse.json({ error: 'new_assignee_id required' }, { status: 400 })
        }

        // Get current assignees
        const currentAssignees = await executeQuery(
            `SELECT ta.user_id, ta.zimbra_task_id, p.email, p.zimbra_sync_enabled
             FROM task_assignees ta
             JOIN profiles p ON ta.user_id = p.id
             WHERE ta.task_id = :task_id`,
            { task_id: id }
        )

        // Remove old assignees & Sync Delete
        if (currentAssignees && currentAssignees.length > 0) {
            for (const assignee of currentAssignees) {
                const zimbraId = assignee.zimbra_task_id || assignee.ZIMBRA_TASK_ID
                const email = assignee.email || assignee.EMAIL
                const syncEnabled = assignee.zimbra_sync_enabled || assignee.ZIMBRA_SYNC_ENABLED

                if (zimbraId && email && syncEnabled === 1) {
                    try {
                        console.log(`Deleting Zimbra task for reassign: ${email} (ID: ${zimbraId})`)
                        await deleteZimbraTaskViaAdminAPI(email, zimbraId)
                    } catch (e) {
                         console.error('Failed to delete old Zimbra task during reassign:', e)
                    }
                }
            }

            await executeNonQuery(
                `DELETE FROM task_assignees WHERE task_id = :task_id`,
                { task_id: id }
            )
        }

        // Add new assignee
        await executeNonQuery(
            `INSERT INTO task_assignees (task_id, user_id, is_completed, assigned_at)
             VALUES (:task_id, :user_id, 0, SYSDATE)`,
            {
                task_id: id,
                user_id: new_assignee_id
            }
        )

        // Sync New Assignee to Zimbra
        try {
             // Fetch newly assigned user info
             const newAssigneeInfo = await executeQuery(
                 `SELECT email, zimbra_sync_enabled FROM profiles WHERE id = :id`,
                 { id: new_assignee_id }
             )
             
             if (newAssigneeInfo && newAssigneeInfo.length > 0) {
                 const assignee = newAssigneeInfo[0]
                 const syncEnabled = assignee.zimbra_sync_enabled || assignee.ZIMBRA_SYNC_ENABLED
                 const email = assignee.email || assignee.EMAIL

                 if (syncEnabled === 1 && email) {
                      // Fetch Task Details
                      const taskDetails = await executeQuery(
                          `SELECT title, notes, due_date, priority FROM tasks WHERE id = :id`,
                          { id }
                      )
                      if (taskDetails && taskDetails.length > 0) {
                          const task = taskDetails[0]
                          console.log(`Creating Zimbra task for reassign: ${email}`)
                          const zimbraRes = await createZimbraTaskViaAdminAPI(
                              email,
                              {
                                  title: task.title || task.TITLE,
                                  notes: task.notes || task.NOTES || '',
                                  due_date: task.due_date || task.DUE_DATE,
                                  priority: task.priority || task.PRIORITY
                              }
                          )

                          if (zimbraRes.success && zimbraRes.taskId) {
                              await executeNonQuery(
                                  `UPDATE task_assignees SET zimbra_task_id = :zid 
                                   WHERE task_id = :tid AND user_id = :uid`,
                                  { zid: zimbraRes.taskId, tid: id, uid: new_assignee_id }
                              )
                          }
                      }
                 }
             }
        } catch(e) {
            console.error("Zimbra sync failure during reassign", e)
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Reassign task error:', error)
        // Don't expose internal error details for security
        return NextResponse.json({ error: 'Failed to reassign task' }, { status: 500 })
    }
}
