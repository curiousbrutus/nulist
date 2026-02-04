import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { user_id, enabled } = body

        if (!user_id || enabled === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        // 1. Check if the current user is secretary or superadmin
        const callerProfile = await executeQuery<any>(
            `SELECT role, branch FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )

        const isSuperadmin = callerProfile[0]?.role === 'superadmin'
        const isSecretary = callerProfile[0]?.role === 'secretary'

        if (!isSuperadmin && !isSecretary) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
        }

        // 2. If secretary, verify target user is in the same branch
        if (isSecretary && !isSuperadmin) {
            const targetProfile = await executeQuery<any>(
                `SELECT branch FROM profiles WHERE id = :id`,
                { id: user_id },
                session.user.id
            )

            if (!targetProfile[0] || targetProfile[0].branch !== callerProfile[0].branch) {
                return NextResponse.json({ error: 'Sadece kendi biriminizdeki personeli yönetebilirsiniz' }, { status: 403 })
            }
        }

        // 3. Update the sync status
        await executeNonQuery(
            `UPDATE profiles SET zimbra_sync_enabled = :enabled, updated_at = SYSTIMESTAMP WHERE id = :id`,
            {
                enabled: enabled ? 1 : 0,
                id: user_id
            },
            session.user.id
        )

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Update sync error:', error)
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
    }
}
