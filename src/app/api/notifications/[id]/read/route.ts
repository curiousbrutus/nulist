import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        const result = await executeNonQuery(
            `UPDATE inapp_notifications
             SET is_read = 1,
                 read_at = SYSTIMESTAMP
             WHERE id = :id AND user_id = :user_id`,
            {
                id,
                user_id: session.user.id
            },
            session.user.id
        )

        if (!result || result.rowsAffected === 0) {
            return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('PATCH /api/notifications/[id]/read error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
