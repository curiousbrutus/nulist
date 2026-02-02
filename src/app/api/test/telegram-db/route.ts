import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/test/telegram-db - Test database access for Telegram bot
export async function GET(request: NextRequest) {
    try {
        console.log('🧪 Testing database access for Telegram bot...')

        // Test 1: Check if we can query profiles
        const profiles = await executeQuery(
            `SELECT id, email, full_name, telegram_user_id FROM profiles WHERE ROWNUM <= 5`,
            {}
        )

        console.log('✅ Profiles query successful:', profiles?.length, 'profiles found')

        // Test 2: Check specific email
        const testEmail = 'eyyubuguven@optimed.com.tr'
        const userCheck = await executeQuery(
            `SELECT id, email, full_name, telegram_user_id FROM profiles WHERE LOWER(email) = LOWER(:email)`,
            { email: testEmail }
        )

        console.log('✅ Email check for', testEmail, ':', userCheck?.length > 0 ? 'Found' : 'Not found')

        // Test 3: Check if user has tasks
        if (userCheck && userCheck.length > 0) {
            const userId = userCheck[0].id
            const tasks = await executeQuery(
                `SELECT COUNT(*) as task_count 
                 FROM task_assignees 
                 WHERE user_id = :user_id`,
                { user_id: userId }
            )
            console.log('✅ Task count:', tasks?.[0]?.task_count || 0)
        }

        return NextResponse.json({
            success: true,
            tests: {
                profiles_query: {
                    success: true,
                    count: profiles?.length || 0,
                    sample: profiles?.[0] || null
                },
                email_check: {
                    email: testEmail,
                    exists: userCheck && userCheck.length > 0,
                    user: userCheck?.[0] || null
                },
                database_connection: true
            },
            message: 'All database tests passed! Telegram bot should work.'
        })
    } catch (error: any) {
        console.error('❌ Database test failed:', error)
        return NextResponse.json(
            {
                success: false,
                error: error.message,
                stack: error.stack,
                message: 'Database access failed. Check Oracle connection.'
            },
            { status: 500 }
        )
    }
}
