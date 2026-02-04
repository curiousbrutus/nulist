import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/profiles/all - Tüm kullanıcıları listele (onboarding ve görev atama için)
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch all profiles - any authenticated user can see the list
        // This is needed for onboarding (manager selection) and task assignment
        const profiles = await executeQuery(
            `SELECT id, email, full_name, department, branch, role, job_title
             FROM profiles 
             ORDER BY full_name NULLS LAST, email`,
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
