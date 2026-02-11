import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/profiles - Profil ara (search query ile)
// UPDATED: Secretaries see ALL branch users, Admins see ALL users
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get user role and branch
        const userProfile = await executeQuery(
            `SELECT role, branch FROM profiles WHERE id = :id`,
            { id: session.user.id }
        )

        if (!userProfile || userProfile.length === 0) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        const role = userProfile[0].ROLE || userProfile[0].role
        const branch = userProfile[0].BRANCH || userProfile[0].branch
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')

        // SECRETARY: Show ALL users in their branch (no search needed)
        if (role === 'secretary' && branch) {
            const profiles = await executeQuery(
                `SELECT id, email, full_name, avatar_url, department, branch
                 FROM profiles
                 WHERE branch = :branch
                 AND id != :current_user_id
                 ORDER BY full_name`,
                { branch, current_user_id: session.user.id }
                // Don't pass userId for VPD bypass - secretary needs to see all in branch
            )
            return NextResponse.json(profiles)
        }

        // ADMIN/SUPERADMIN: Show ALL users
        if (role === 'admin' || role === 'superadmin') {
            const profiles = await executeQuery(
                `SELECT id, email, full_name, avatar_url, department, branch
                 FROM profiles
                 WHERE id != :current_user_id
                 ORDER BY full_name`,
                { current_user_id: session.user.id }
                // Don't pass userId for VPD bypass - admin sees everyone
            )
            return NextResponse.json(profiles)
        }

        // REGULAR USERS: Keep existing search behavior
        if (!query || query.length < 2) {
            return NextResponse.json([])
        }

        const profiles = await executeQuery(
            `SELECT id, email, full_name, avatar_url, department
             FROM profiles
             WHERE (LOWER(full_name) LIKE LOWER(:query) OR LOWER(email) LIKE LOWER(:query))
             AND id != :current_user_id
             AND ROWNUM <= 5`,
            {
                query: `%${query}%`,
                current_user_id: session.user.id
            },
            session.user.id // Apply VPD for regular users
        )

        return NextResponse.json(profiles)
    } catch (error: any) {
        console.error('GET /api/profiles error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
