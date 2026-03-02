import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeTransaction } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/profiles/me - Mevcut kullanıcı profili
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        console.log('[/api/profiles/me] session', JSON.stringify({
            user: session?.user ? {
                id: session.user.id,
                email: session.user.email,
                role: (session.user as any).role
            } : null
        }))
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Prefer id; fallback to email if id missing
        const userId = session.user.id as string | undefined
        const userEmail = session.user.email as string | undefined

        try {
            const query = userId
                ? `SELECT id, email, full_name, avatar_url, department, role, branch, meeting_type, telegram_user_id, 
                          job_title, phone, manager_id, is_profile_complete, created_at, updated_at
                   FROM profiles
                   WHERE id = :id`
                : `SELECT id, email, full_name, avatar_url, department, role, branch, meeting_type, telegram_user_id,
                          job_title, phone, manager_id, is_profile_complete, created_at, updated_at
                   FROM profiles
                   WHERE email = :email`

            const params = userId ? { id: userId } : { email: userEmail }

            const profiles = await executeQuery(
                query,
                params,
                userId // only set VPD context when id is available
            )

            if (profiles.length === 0) {
                return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
            }

            const currentProfile = profiles[0] as any
            const managers = await executeQuery(
                `SELECT pm.manager_id AS id,
                        pm.is_primary,
                        p.full_name,
                        p.email,
                        p.department,
                        p.branch
                 FROM profile_managers pm
                 JOIN profiles p ON p.id = pm.manager_id
                 WHERE pm.profile_id = :profile_id
                 ORDER BY pm.is_primary DESC, p.full_name ASC`,
                { profile_id: currentProfile.id },
                session.user.id
            )

            return NextResponse.json({
                ...currentProfile,
                manager_ids: managers.map((m: any) => m.id),
                managers
            })
        } catch (dbError: any) {
            console.error('[/api/profiles/me] DB error', dbError)
            return NextResponse.json({ error: 'DB error', detail: dbError?.message }, { status: 500 })
        }
    } catch (error: any) {
        console.error('GET /api/profiles/me error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// PUT /api/profiles/me - Profil güncelle
export async function PUT(request: NextRequest) {
    let body: any = {};
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        body = await request.json()
        const {
            full_name,
            avatar_url,
            department,
            role,
            branch,
            meeting_type,
            zimbra_sync_enabled,
            telegram_user_id,
            job_title,
            phone,
            manager_ids
        } = body

        // Check if user is superadmin for role changes
        const currentProfile = await executeQuery(
            `SELECT role, branch, full_name, department, job_title, manager_id FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )
        const currentRole = currentProfile[0]?.role || currentProfile[0]?.ROLE
        const isSuperadmin = currentRole === 'superadmin'
        const isSecretary = currentRole === 'secretary'

        const updates: string[] = []
        const params: any = { id: session.user.id }

        if (full_name !== undefined) {
            updates.push('full_name = :full_name')
            params.full_name = full_name
        }

        if (avatar_url !== undefined) {
            updates.push('avatar_url = :avatar_url')
            params.avatar_url = avatar_url
        }

        if (department !== undefined) {
            updates.push('department = :department')
            params.department = department
        }

        if (branch !== undefined) {
            updates.push('branch = :branch')
            params.branch = branch
        }

        if (job_title !== undefined) {
            updates.push('job_title = :job_title')
            params.job_title = job_title
        }

        if (phone !== undefined) {
            updates.push('phone = :phone')
            params.phone = phone
        }

        if (meeting_type !== undefined && (isSecretary || isSuperadmin)) {
            updates.push('meeting_type = :meeting_type')
            params.meeting_type = meeting_type
        }

        if (zimbra_sync_enabled !== undefined) {
            updates.push('zimbra_sync_enabled = :zimbra_sync_enabled')
            params.zimbra_sync_enabled = zimbra_sync_enabled ? 1 : 0
        }

        if (telegram_user_id !== undefined) {
            updates.push('telegram_user_id = :telegram_user_id')
            params.telegram_user_id = telegram_user_id
        }

        // Only superadmins can change roles
        if (isSuperadmin) {
            if (role !== undefined) {
                updates.push('role = :role')
                params.role = role
            }
        }

        const hasManagerUpdate = manager_ids !== undefined
        let sanitizedManagerIds: string[] = []
        if (hasManagerUpdate) {
            if (!Array.isArray(manager_ids)) {
                return NextResponse.json({ error: 'manager_ids must be an array' }, { status: 400 })
            }

            const uniqueManagerIds = Array.from(
                new Set(
                    manager_ids
                        .filter((value: any) => typeof value === 'string')
                        .map((value: string) => value.trim())
                        .filter((value: string) => value.length > 0)
                )
            )

            sanitizedManagerIds = uniqueManagerIds.filter((managerId) => managerId !== session.user.id)

            if (uniqueManagerIds.length !== sanitizedManagerIds.length) {
                return NextResponse.json({ error: 'User cannot be their own manager' }, { status: 400 })
            }

            if (sanitizedManagerIds.length > 0) {
                const placeholders = sanitizedManagerIds.map((_, index) => `:mid_${index}`).join(', ')
                const verifyParams: Record<string, string> = {}
                sanitizedManagerIds.forEach((managerId, index) => {
                    verifyParams[`mid_${index}`] = managerId
                })

                const verifiedManagers = await executeQuery(
                    `SELECT id FROM profiles WHERE id IN (${placeholders})`,
                    verifyParams
                )

                if (verifiedManagers.length !== sanitizedManagerIds.length) {
                    return NextResponse.json({ error: 'Some selected managers were not found' }, { status: 400 })
                }
            }

            updates.push('manager_id = :manager_id')
            params.manager_id = sanitizedManagerIds[0] || null
        }

        const nextFullName = full_name !== undefined ? full_name : currentProfile[0]?.full_name
        const nextDepartment = department !== undefined ? department : currentProfile[0]?.department
        const nextBranch = branch !== undefined ? branch : currentProfile[0]?.branch
        const nextJobTitle = job_title !== undefined ? job_title : currentProfile[0]?.job_title
        const currentManagerId = currentProfile[0]?.manager_id
        const nextPrimaryManager = hasManagerUpdate ? (sanitizedManagerIds[0] || null) : currentManagerId
        const profileComplete =
            nextFullName &&
            nextDepartment &&
            nextBranch &&
            nextJobTitle &&
            nextPrimaryManager

        updates.push('is_profile_complete = :is_profile_complete')
        params.is_profile_complete = profileComplete ? 1 : 0

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            )
        }

        updates.push('updated_at = SYSTIMESTAMP')

        const sql = `UPDATE profiles SET ${updates.join(', ')} WHERE id = :id`

        await executeTransaction(async (connection: any) => {
            await connection.execute(sql, params, { autoCommit: false })

            if (hasManagerUpdate) {
                await connection.execute(
                    `DELETE FROM profile_managers WHERE profile_id = :profile_id`,
                    { profile_id: session.user.id },
                    { autoCommit: false }
                )

                for (let index = 0; index < sanitizedManagerIds.length; index++) {
                    await connection.execute(
                        `INSERT INTO profile_managers (profile_id, manager_id, is_primary, assigned_by)
                         VALUES (:profile_id, :manager_id, :is_primary, :assigned_by)`,
                        {
                            profile_id: session.user.id,
                            manager_id: sanitizedManagerIds[index],
                            is_primary: index === 0 ? 1 : 0,
                            assigned_by: session.user.id
                        },
                        { autoCommit: false }
                    )
                }
            }
        }, session.user.id)

        const profiles = await executeQuery(
            `SELECT id, email, full_name, avatar_url, department, role, branch, meeting_type, telegram_user_id,
                    zimbra_sync_enabled, zimbra_last_sync, job_title, phone, manager_id, is_profile_complete,
                    created_at, updated_at
             FROM profiles
             WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )

        const managers = await executeQuery(
            `SELECT pm.manager_id AS id,
                    pm.is_primary,
                    p.full_name,
                    p.email,
                    p.department,
                    p.branch
             FROM profile_managers pm
             JOIN profiles p ON p.id = pm.manager_id
             WHERE pm.profile_id = :profile_id
             ORDER BY pm.is_primary DESC, p.full_name ASC`,
            { profile_id: session.user.id },
            session.user.id
        )

        return NextResponse.json({
            ...profiles[0],
            manager_ids: managers.map((m: any) => m.id),
            managers
        })
    } catch (error: any) {
        console.error('PUT /api/profiles/me error:', error)
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'api-error.log');
            fs.writeFileSync(logPath, `Date: ${new Date().toISOString()}\nError: ${error.message}\nStack: ${error.stack}\nSQL: ${error.statement}\nParams: ${JSON.stringify(error.params)}\nBody: ${JSON.stringify(body)}\n`);
        } catch (e) { console.error('Log write failed', e) }

        return NextResponse.json(
            { error: 'Server Error: ' + (error.message || 'Unknown error') },
            { status: 500 }
        )
    }
}
