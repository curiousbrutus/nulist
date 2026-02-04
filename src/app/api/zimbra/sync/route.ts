import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncTasksToZimbra, syncTasksFromZimbra } from '@/lib/zimbra-sync'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// POST /api/zimbra/sync - Manual sync trigger (for testing or on-demand sync)
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { direction = 'to_zimbra', user_email } = body

        // Use current user's email if not specified
        const targetEmail = user_email || session.user.email
        const targetUserId = session.user.id

        if (direction === 'to_zimbra') {
            // Sync from NeoList to Zimbra
            const result = await syncTasksToZimbra(targetEmail!, targetUserId)
            
            if (result.success) {
                return NextResponse.json({
                    message: `${result.synced} görev Zimbra'ya senkronize edildi`,
                    synced: result.synced,
                    total: result.total
                })
            } else {
                return NextResponse.json(
                    { error: 'Zimbra sync failed', details: result.errors },
                    { status: 500 }
                )
            }
        } else if (direction === 'from_zimbra') {
            // Sync from Zimbra to NeoList
            const result = await syncTasksFromZimbra(targetEmail!, targetUserId)
            
            if (result.success) {
                return NextResponse.json({
                    message: `Zimbra'dan ${result.tasks?.length || 0} görev alındı`,
                    tasks: result.tasks
                })
            } else {
                return NextResponse.json(
                    { error: 'Zimbra sync failed', details: result.error },
                    { status: 500 }
                )
            }
        } else if (direction === 'bidirectional') {
            // Bidirectional sync
            const toZimbra = await syncTasksToZimbra(targetEmail!, targetUserId)
            const fromZimbra = await syncTasksFromZimbra(targetEmail!, targetUserId)
            
            return NextResponse.json({
                message: 'Çift yönlü senkronizasyon tamamlandı',
                to_zimbra: toZimbra,
                from_zimbra: fromZimbra
            })
        } else {
            return NextResponse.json(
                { error: 'Invalid direction parameter. Use: to_zimbra, from_zimbra, or bidirectional' },
                { status: 400 }
            )
        }
    } catch (error: any) {
        console.error('Zimbra sync error:', error)
        return NextResponse.json(
            { error: 'Sync failed', details: error.message },
            { status: 500 }
        )
    }
}

// GET /api/zimbra/sync - Background sync job (called by cron or scheduler)
export async function GET(request: NextRequest) {
    try {
        // Verify this is called from internal cron/scheduler
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized cron access' }, { status: 401 })
        }

        // Get all active users with email addresses
        const users = await executeQuery(
            `SELECT id, email FROM profiles WHERE email IS NOT NULL`,
            {},
            'system'
        )

        if (!users || users.length === 0) {
            return NextResponse.json({ message: 'No users to sync' })
        }

        const results = []

        // Sync for each user (limit to prevent timeout)
        for (const user of users.slice(0, 50)) { // Process 50 users per run
            try {
                const result = await syncTasksToZimbra(user.email, user.id)
                results.push({
                    user_id: user.id,
                    email: user.email,
                    success: result.success,
                    synced: result.synced,
                    errors: result.errors
                })
            } catch (error) {
                results.push({
                    user_id: user.id,
                    email: user.email,
                    success: false,
                    error: (error as Error).message
                })
            }
        }

        const successCount = results.filter(r => r.success).length
        const totalSynced = results.reduce((sum, r) => sum + (r.synced || 0), 0)

        return NextResponse.json({
            message: 'Background sync completed',
            total_users: results.length,
            successful: successCount,
            failed: results.length - successCount,
            total_tasks_synced: totalSynced,
            results: results
        })
    } catch (error: any) {
        console.error('Background sync error:', error)
        return NextResponse.json(
            { error: 'Background sync failed', details: error.message },
            { status: 500 }
        )
    }
}
