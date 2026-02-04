import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeNonQuery, executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// POST /api/profiles/onboarding - Complete user profile
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            full_name,
            department,
            branch,
            job_title,
            phone,
            manager_id,
            meeting_type,
            is_profile_complete
        } = body

        // Validate required fields
        if (!full_name || !department || !branch || !job_title) {
            return NextResponse.json(
                { error: 'Ad Soyad, Birim, Şube ve Ünvan zorunludur' },
                { status: 400 }
            )
        }

        // Update profile
        await executeNonQuery(
            `UPDATE profiles
             SET full_name = :full_name,
                 department = :department,
                 branch = :branch,
                 job_title = :job_title,
                 phone = :phone,
                 manager_id = :manager_id,
                 meeting_type = :meeting_type,
                 is_profile_complete = :is_profile_complete
             WHERE id = :id`,
            {
                full_name,
                department,
                branch,
                job_title,
                phone: phone || null,
                manager_id: manager_id || null,
                meeting_type: meeting_type || null,
                is_profile_complete: is_profile_complete ? 1 : 0,
                id: session.user.id
            },
            session.user.id
        )

        // Return updated profile
        const profiles = await executeQuery(
            `SELECT id, email, full_name, avatar_url, department, role, branch, 
                    meeting_type, telegram_user_id, job_title, phone, manager_id, 
                    is_profile_complete, created_at, updated_at
             FROM profiles
             WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )

        if (profiles.length === 0) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        return NextResponse.json(profiles[0])
    } catch (error: any) {
        console.error('POST /api/profiles/onboarding error:', error)
        return NextResponse.json(
            { error: 'Internal server error', detail: error.message },
            { status: 500 }
        )
    }
}
