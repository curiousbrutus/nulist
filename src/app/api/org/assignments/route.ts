import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeTransaction } from '@/lib/oracle'

export const runtime = 'nodejs'

function normalizeIds(values: unknown): string[] {
    if (!Array.isArray(values)) return []
    return Array.from(
        new Set(
            values
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
        )
    )
}

function makePlaceholders(prefix: string, ids: string[]) {
    const params: Record<string, string> = {}
    const placeholders = ids.map((id, index) => {
        const key = `${prefix}_${index}`
        params[key] = id
        return `:${key}`
    })
    return { placeholders: placeholders.join(', '), params }
}

async function resolveTargetUserId(request: NextRequest, currentUserId: string) {
    const { searchParams } = new URL(request.url)
    const requestedUserId = (searchParams.get('user_id') || '').trim()

    if (!requestedUserId || requestedUserId === currentUserId) {
        return currentUserId
    }

    const roleRows = await executeQuery(
        `SELECT role FROM profiles WHERE id = :id`,
        { id: currentUserId },
        currentUserId
    )
    const role = roleRows[0]?.role || roleRows[0]?.ROLE

    if (role !== 'admin' && role !== 'superadmin') {
        return null
    }

    return requestedUserId
}

async function loadAssignments(userId: string, actorUserId: string) {
    const facilities = await executeQuery(
        `SELECT uf.facility_id AS id,
                uf.is_primary,
                f.name
         FROM user_facilities uf
         JOIN facilities f ON f.id = uf.facility_id
         WHERE uf.user_id = :user_id
         ORDER BY uf.is_primary DESC, f.name ASC`,
        { user_id: userId },
        actorUserId
    )

    const departments = await executeQuery(
        `SELECT ud.department_id AS id,
                ud.is_primary,
                d.name,
                d.facility_id,
                f.name AS facility_name
         FROM user_departments ud
         JOIN departments d ON d.id = ud.department_id
         JOIN facilities f ON f.id = d.facility_id
         WHERE ud.user_id = :user_id
         ORDER BY ud.is_primary DESC, f.name ASC, d.name ASC`,
        { user_id: userId },
        actorUserId
    )

    return {
        user_id: userId,
        facility_ids: facilities.map((item: any) => item.id || item.ID),
        department_ids: departments.map((item: any) => item.id || item.ID),
        facilities,
        departments
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const targetUserId = await resolveTargetUserId(request, session.user.id)
        if (!targetUserId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const result = await loadAssignments(targetUserId, session.user.id)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('GET /api/org/assignments error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const requestedUserId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
        const targetUserId = requestedUserId || session.user.id

        if (targetUserId !== session.user.id) {
            const roleRows = await executeQuery(
                `SELECT role FROM profiles WHERE id = :id`,
                { id: session.user.id },
                session.user.id
            )
            const role = roleRows[0]?.role || roleRows[0]?.ROLE
            if (role !== 'admin' && role !== 'superadmin') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        const facilityIds = normalizeIds(body.facility_ids)
        const departmentIds = normalizeIds(body.department_ids)

        if (departmentIds.length > 0) {
            const { placeholders, params } = makePlaceholders('dept', departmentIds)
            const departmentRows = await executeQuery(
                `SELECT id, facility_id
                 FROM departments
                 WHERE id IN (${placeholders})`,
                params,
                session.user.id
            )

            if (departmentRows.length !== departmentIds.length) {
                return NextResponse.json({ error: 'Some departments were not found' }, { status: 400 })
            }

            const departmentFacilityIds = new Set<string>()
            for (const row of departmentRows) {
                const facilityId = row.facility_id || row.FACILITY_ID
                if (facilityId) {
                    departmentFacilityIds.add(facilityId)
                }
            }

            for (const facilityId of departmentFacilityIds) {
                if (!facilityIds.includes(facilityId)) {
                    facilityIds.push(facilityId)
                }
            }
        }

        if (facilityIds.length > 0) {
            const { placeholders, params } = makePlaceholders('fac', facilityIds)
            const facilities = await executeQuery(
                `SELECT id, name FROM facilities WHERE id IN (${placeholders})`,
                params,
                session.user.id
            )

            if (facilities.length !== facilityIds.length) {
                return NextResponse.json({ error: 'Some facilities were not found' }, { status: 400 })
            }
        }

        let primaryFacilityName: string | null = null
        let primaryFacilityId: string | null = null

        if (facilityIds.length > 0) {
            const { placeholders, params } = makePlaceholders('fac_name', facilityIds)
            const facilities = await executeQuery(
                `SELECT id, name
                 FROM facilities
                 WHERE id IN (${placeholders})`,
                params,
                session.user.id
            )
            const firstId = facilityIds[0]
            const first = facilities.find((item: any) => (item.id || item.ID) === firstId)
            primaryFacilityId = firstId
            primaryFacilityName = first ? (first.name || first.NAME) : null
        }

        await executeTransaction(async (connection: any) => {
            await connection.execute(
                `DELETE FROM user_departments WHERE user_id = :user_id`,
                { user_id: targetUserId },
                { autoCommit: false }
            )

            for (let index = 0; index < departmentIds.length; index++) {
                await connection.execute(
                    `INSERT INTO user_departments (id, user_id, department_id, is_primary, assigned_by)
                     VALUES (SYS_GUID(), :user_id, :department_id, :is_primary, :assigned_by)`,
                    {
                        user_id: targetUserId,
                        department_id: departmentIds[index],
                        is_primary: index === 0 ? 1 : 0,
                        assigned_by: session.user.id
                    },
                    { autoCommit: false }
                )
            }

            await connection.execute(
                `DELETE FROM user_facilities WHERE user_id = :user_id`,
                { user_id: targetUserId },
                { autoCommit: false }
            )

            for (let index = 0; index < facilityIds.length; index++) {
                await connection.execute(
                    `INSERT INTO user_facilities (id, user_id, facility_id, is_primary, assigned_by)
                     VALUES (SYS_GUID(), :user_id, :facility_id, :is_primary, :assigned_by)`,
                    {
                        user_id: targetUserId,
                        facility_id: facilityIds[index],
                        is_primary: index === 0 ? 1 : 0,
                        assigned_by: session.user.id
                    },
                    { autoCommit: false }
                )
            }

            await connection.execute(
                `UPDATE profiles
                 SET primary_facility_id = :primary_facility_id,
                     branch = :branch,
                     updated_at = SYSTIMESTAMP
                 WHERE id = :user_id`,
                {
                    user_id: targetUserId,
                    primary_facility_id: primaryFacilityId,
                    branch: facilityIds.length > 1 ? 'Tüm Şubeler' : primaryFacilityName
                },
                { autoCommit: false }
            )

            if (departmentIds.length > 0) {
                const placeholders = departmentIds.map((_, index) => `:dept_${index}`).join(', ')
                const deptParams: Record<string, string> = {}
                departmentIds.forEach((id, index) => {
                    deptParams[`dept_${index}`] = id
                })

                const departmentRows = await connection.execute(
                    `SELECT d.id, d.name, f.name AS facility_name
                     FROM departments d
                     JOIN facilities f ON f.id = d.facility_id
                     WHERE d.id IN (${placeholders})`,
                    deptParams,
                    { autoCommit: false }
                )

                for (const row of (departmentRows.rows || []) as any[]) {
                    const departmentName = row[1]
                    const facilityName = row[2]

                    const folderRows = await connection.execute(
                        `SELECT f.id
                         FROM folders f
                         LEFT JOIN folders p ON p.id = f.parent_id
                         WHERE (
                            (UPPER(TRIM(f.title)) = UPPER(TRIM(:department_name))
                             AND (p.id IS NULL OR UPPER(TRIM(p.title)) = UPPER(TRIM(:facility_name))))
                            OR
                            (UPPER(TRIM(f.title)) = UPPER(TRIM(:facility_name))
                             AND UPPER(TRIM(NVL(p.title, ''))) = UPPER(TRIM(:department_name)))
                         )`,
                        {
                            department_name: departmentName,
                            facility_name: facilityName
                        },
                        { autoCommit: false }
                    )

                    for (const folderRow of (folderRows.rows || []) as any[]) {
                        const folderId = folderRow[0]

                        const exists = await connection.execute(
                            `SELECT 1
                             FROM folder_members
                             WHERE folder_id = :folder_id
                               AND user_id = :user_id`,
                            { folder_id: folderId, user_id: targetUserId },
                                                        { autoCommit: false }
                        )

                        if ((exists.rows || []).length === 0) {
                            await connection.execute(
                                `INSERT INTO folder_members (
                                    id, folder_id, user_id, role, can_add_task, can_assign_task, can_delete_task, can_add_list
                                ) VALUES (
                                    SYS_GUID(), :folder_id, :user_id, 'member', 1, 1, 0, 0
                                )`,
                                {
                                    folder_id: folderId,
                                    user_id: targetUserId
                                },
                                { autoCommit: false }
                            )
                        }
                    }
                }
            }
        }, session.user.id)

        const result = await loadAssignments(targetUserId, session.user.id)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('PUT /api/org/assignments error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
