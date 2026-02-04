import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

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

            return NextResponse.json(profiles[0])
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
        const { full_name, avatar_url, department, role, branch, meeting_type, zimbra_sync_enabled, telegram_user_id } = body

        // Check if user is superadmin for role changes
        const currentProfile = await executeQuery(
            `SELECT role, branch FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )
        const isSuperadmin = currentProfile[0]?.role === 'superadmin'
        const isSecretary = currentProfile[0]?.role === 'secretary'

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

        if (zimbra_sync_enabled !== undefined) {
            updates.push('zimbra_sync_enabled = :zimbra_sync_enabled')
            params.zimbra_sync_enabled = zimbra_sync_enabled ? 1 : 0
        }

        if (telegram_user_id !== undefined) {
            updates.push('telegram_user_id = :telegram_user_id')
            params.telegram_user_id = telegram_user_id
        }

        // Only superadmins can change roles and branches
        if (isSuperadmin) {
            if (role !== undefined) {
                updates.push('role = :role')
                params.role = role
            }

            if (branch !== undefined) {
                updates.push('branch = :branch')
                params.branch = branch
            }

            if (meeting_type !== undefined) {
                updates.push('meeting_type = :meeting_type')
                params.meeting_type = meeting_type
            }
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            )
        }

        updates.push('updated_at = SYSTIMESTAMP')

        const sql = `UPDATE profiles SET ${updates.join(', ')} WHERE id = :id`

        await executeNonQuery(sql, params, session.user.id)

        const profiles = await executeQuery(
            `SELECT id, email, full_name, avatar_url, department, role, branch, meeting_type, telegram_user_id, zimbra_sync_enabled, zimbra_last_sync, created_at, updated_at
             FROM profiles
             WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )

        return NextResponse.json(profiles[0])
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
