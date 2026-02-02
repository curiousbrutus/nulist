import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/profiles/all - Tüm kullanıcıları listele (secretary/superadmin için)
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user has permission (secretary or superadmin)
        const userProfile = await executeQuery(
            `SELECT role FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )

        if (!userProfile || userProfile.length === 0) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        const userRole = userProfile[0].role
        if (userRole !== 'secretary' && userRole !== 'superadmin') {
            return NextResponse.json(
                { error: 'Bu işlem için sekreter veya superadmin yetkisi gereklidir' },
                { status: 403 }
            )
        }

        // Fetch all profiles
        const profiles = await executeQuery(
            `SELECT id, email, full_name, department, branch, role 
             FROM profiles 
             ORDER BY full_name`,
            {},
            session.user.id
        )

        return NextResponse.json(profiles)
    } catch (error: any) {
        console.error('GET /api/profiles/all error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
