import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminProfile = await executeQuery(
            `SELECT id, role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        const adminRole = String(adminProfile?.[0]?.role || adminProfile?.[0]?.ROLE || '')
        if (!adminProfile?.[0] || (adminRole !== 'admin' && adminRole !== 'superadmin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const targetUserId = searchParams.get('user_id')

        if (!targetUserId) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
        }

        const targetRows = await executeQuery(
            `SELECT id, full_name, email, role FROM profiles WHERE id = :id`,
            { id: targetUserId }
        )

        if (!targetRows?.[0]) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
        }

        const target = targetRows[0]
        const targetRole = String(target.role || target.ROLE || '')
        const isPrivileged = targetRole === 'admin' || targetRole === 'superadmin' ? 1 : 0

        const commonParams = {
            user_id: targetUserId,
            is_privileged: isPrivileged
        }

        const totalTasksRows = await executeQuery(`SELECT COUNT(*) AS total_count FROM tasks`)
        const visibleTasksRows = await executeQuery(
            `SELECT COUNT(*) AS visible_count
             FROM tasks t
             JOIN lists l ON t.list_id = l.id
             JOIN folders f ON l.folder_id = f.id
             LEFT JOIN folders pf ON pf.id = f.parent_id
             WHERE (
                :is_privileged = 1
                OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = :user_id)
                OR t.created_by = :user_id
                OR f.user_id = :user_id
                OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
                OR EXISTS (
                    SELECT 1
                    FROM user_departments ud
                    JOIN departments d ON d.id = ud.department_id
                    JOIN facilities fac ON fac.id = d.facility_id
                    WHERE ud.user_id = :user_id
                      AND (
                        UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                        OR UPPER(TRIM(NVL(pf.title, ''))) = UPPER(TRIM(d.name))
                      )
                      AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
                )
             )`,
            commonParams
        )

        const totalListsRows = await executeQuery(`SELECT COUNT(*) AS total_count FROM lists`)
        const visibleListsRows = await executeQuery(
            `SELECT COUNT(*) AS visible_count
             FROM lists l
             JOIN folders f ON f.id = l.folder_id
             LEFT JOIN folders pf ON pf.id = f.parent_id
             WHERE (
                :is_privileged = 1
                OR f.user_id = :user_id
                OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
                OR EXISTS (
                    SELECT 1
                    FROM user_departments ud
                    JOIN departments d ON d.id = ud.department_id
                    JOIN facilities fac ON fac.id = d.facility_id
                    WHERE ud.user_id = :user_id
                      AND (
                        UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                        OR UPPER(TRIM(NVL(pf.title, ''))) = UPPER(TRIM(d.name))
                      )
                      AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
                )
             )`,
            commonParams
        )

        const totalFoldersRows = await executeQuery(`SELECT COUNT(*) AS total_count FROM folders`)
        const visibleFoldersRows = await executeQuery(
            `SELECT COUNT(*) AS visible_count
             FROM folders f
             LEFT JOIN folders pf ON pf.id = f.parent_id
             WHERE (
                :is_privileged = 1
                OR f.user_id = :user_id
                OR f.id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
                OR EXISTS (
                    SELECT 1
                    FROM user_departments ud
                    JOIN departments d ON d.id = ud.department_id
                    JOIN facilities fac ON fac.id = d.facility_id
                    WHERE ud.user_id = :user_id
                      AND (
                        UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                        OR UPPER(TRIM(NVL(pf.title, ''))) = UPPER(TRIM(d.name))
                      )
                      AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
                )
             )`,
            commonParams
        )

        const toNumber = (value: any) => Number(value || 0)

        return NextResponse.json({
            target_user_id: target.id,
            target_user_name: target.full_name,
            target_user_email: target.email,
            target_user_role: targetRole,
            total_tasks: toNumber(totalTasksRows?.[0]?.total_count ?? totalTasksRows?.[0]?.TOTAL_COUNT),
            visible_tasks: toNumber(visibleTasksRows?.[0]?.visible_count ?? visibleTasksRows?.[0]?.VISIBLE_COUNT),
            total_lists: toNumber(totalListsRows?.[0]?.total_count ?? totalListsRows?.[0]?.TOTAL_COUNT),
            visible_lists: toNumber(visibleListsRows?.[0]?.visible_count ?? visibleListsRows?.[0]?.VISIBLE_COUNT),
            total_folders: toNumber(totalFoldersRows?.[0]?.total_count ?? totalFoldersRows?.[0]?.TOTAL_COUNT),
            visible_folders: toNumber(visibleFoldersRows?.[0]?.visible_count ?? visibleFoldersRows?.[0]?.VISIBLE_COUNT)
        })
    } catch (error: any) {
        console.error('GET /api/admin/tasks/scope error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
