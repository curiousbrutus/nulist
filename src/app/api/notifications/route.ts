import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const rows = await executeQuery(
            `SELECT id, user_id, event_id, title, body, is_read, read_at, created_at
             FROM inapp_notifications
             WHERE user_id = :user_id
             ORDER BY created_at DESC
             FETCH FIRST 100 ROWS ONLY`,
            { user_id: session.user.id },
            session.user.id
        )

        return NextResponse.json(rows || [])
    } catch (error: any) {
        console.error('GET /api/notifications error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
