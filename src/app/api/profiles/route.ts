import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/profiles - Profil ara (search query ile)
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')

        if (!query || query.length < 2) {
            return NextResponse.json([])
        }

        const profiles = await executeQuery(
            `SELECT id, email, full_name, avatar_url
             FROM profiles
             WHERE (LOWER(full_name) LIKE LOWER(:query) OR LOWER(email) LIKE LOWER(:query))
             AND id != :current_user_id
             AND ROWNUM <= 5`,
            {
                query: `%${query}%`,
                current_user_id: session.user.id
            },
            session.user.id
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
