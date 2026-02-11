import { executeQuery, getConnection, closePool } from './src/lib/oracle'
import { createZimbraTaskViaAdminAPI } from './src/lib/zimbra-sync'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function diagnose() {
    try {
        console.log('🔍 NeoList → Zimbra Sync Diagnostic Tool\n')
        console.log('=' .repeat(60))
        
        await getConnection()
        
        // Step 1: Check environment configuration
        console.log('\n📋 Step 1: Environment Configuration')
        console.log('-'.repeat(60))
        console.log('ZIMBRA_ADMIN_EMAIL:', process.env.ZIMBRA_ADMIN_EMAIL || '❌ NOT SET')
        console.log('ZIMBRA_ADMIN_PASSWORD:', process.env.ZIMBRA_ADMIN_PASSWORD ? '✓ SET' : '❌ NOT SET')
        console.log('ZIMBRA_CALDAV_URL:', process.env.ZIMBRA_CALDAV_URL || '❌ NOT SET')
        
        // Step 2: Check user sync settings
        console.log('\n👥 Step 2: User Sync Settings')
        console.log('-'.repeat(60))
        const users = await executeQuery(`
            SELECT id, email, full_name, zimbra_sync_enabled, zimbra_last_sync 
            FROM profiles 
            WHERE ROWNUM <= 5
            ORDER BY created_at DESC
        `)
        
        if (users.length === 0) {
            console.log('❌ No users found in database')
        } else {
            users.forEach((u: any) => {
                const syncEnabled = (u.ZIMBRA_SYNC_ENABLED || u.zimbra_sync_enabled) === 1
                console.log(`  ${syncEnabled ? '✓' : '✗'} ${u.EMAIL || u.email} (${u.FULL_NAME || u.full_name})`)
                console.log(`     Sync Enabled: ${syncEnabled ? 'YES' : 'NO'}`)
                console.log(`     Last Sync: ${u.ZIMBRA_LAST_SYNC || u.zimbra_last_sync || 'Never'}`)
            })
        }
        
        // Step 3: Check recent tasks
        console.log('\n📝 Step 3: Recent Tasks')
        console.log('-'.repeat(60))
        const tasks = await executeQuery(`
            SELECT t.id, t.title, t.created_by, p.email 
            FROM tasks t
            JOIN profiles p ON t.created_by = p.id
            WHERE ROWNUM <= 5
            ORDER BY t.created_at DESC
        `)
        
        if (tasks.length === 0) {
            console.log('❌ No tasks found')
        } else {
            console.log(`Found ${tasks.length} recent tasks:`)
            tasks.forEach((t: any) => {
                console.log(`  - ${t.TITLE || t.title} (ID: ${t.ID || t.id})`)
                console.log(`    Created by: ${t.EMAIL || t.email}`)
            })
        }
        
        // Step 4: Check task assignees and zimbra_task_id
        console.log('\n👤 Step 4: Task Assignments & Zimbra IDs')
        console.log('-'.repeat(60))
        const assignees = await executeQuery(`
            SELECT ta.task_id, ta.user_id, ta.zimbra_task_id, t.title, p.email, p.zimbra_sync_enabled
            FROM task_assignees ta
            JOIN tasks t ON ta.task_id = t.id
            JOIN profiles p ON ta.user_id = p.id
            WHERE ROWNUM <= 10
            ORDER BY ta.assigned_at DESC
        `)
        
        if (assignees.length === 0) {
            console.log('❌ No task assignments found')
        } else {
            let withZimbraId = 0
            let syncEnabled = 0
            assignees.forEach((a: any) => {
                const hasZimbraId = !!(a.ZIMBRA_TASK_ID || a.zimbra_task_id)
                const isSyncEnabled = (a.ZIMBRA_SYNC_ENABLED || a.zimbra_sync_enabled) === 1
                if (hasZimbraId) withZimbraId++
                if (isSyncEnabled) syncEnabled++
                
                console.log(`  ${hasZimbraId ? '✓' : '✗'} Task: ${a.TITLE || a.title}`)
                console.log(`    Assigned to: ${a.EMAIL || a.email}`)
                console.log(`    Zimbra Sync: ${isSyncEnabled ? 'ENABLED' : 'DISABLED'}`)
                console.log(`    Zimbra Task ID: ${a.ZIMBRA_TASK_ID || a.zimbra_task_id || 'NOT SET ❌'}`)
            })
            console.log(`\n  Summary: ${withZimbraId}/${assignees.length} have Zimbra IDs, ${syncEnabled}/${assignees.length} users have sync enabled`)
        }
        
        // Step 5: Check sync queue
        console.log('\n⏳ Step 5: Sync Queue Status')
        console.log('-'.repeat(60))
        const queueStats = await executeQuery(`
            SELECT status, COUNT(*) as cnt 
            FROM sync_queue 
            GROUP BY status
        `)
        
        if (queueStats.length === 0) {
            console.log('ℹ️  Sync queue is empty (no pending/failed jobs)')
        } else {
            queueStats.forEach((s: any) => {
                const status = s.STATUS || s.status
                const count = s.CNT || s.cnt
                const icon = status === 'COMPLETED' ? '✓' : status === 'FAILED' ? '✗' : '⏳'
                console.log(`  ${icon} ${status}: ${count} jobs`)
            })
        }
        
        // Step 6: Check recent queue jobs
        const recentJobs = await executeQuery(`
            SELECT id, task_id, user_email, action_type, status, error_message, created_at
            FROM sync_queue
            WHERE ROWNUM <= 5
            ORDER BY created_at DESC
        `)
        
        if (recentJobs.length > 0) {
            console.log('\n  Recent Queue Jobs:')
            recentJobs.forEach((j: any) => {
                const status = j.STATUS || j.status
                const action = j.ACTION_TYPE || j.action_type
                const email = j.USER_EMAIL || j.user_email
                const icon = status === 'COMPLETED' ? '✓' : status === 'FAILED' ? '✗' : '⏳'
                console.log(`    ${icon} ${action} for ${email} - ${status}`)
                if (status === 'FAILED' && (j.ERROR_MESSAGE || j.error_message)) {
                    const errMsg = (j.ERROR_MESSAGE || j.error_message).toString()
                    console.log(`       Error: ${errMsg.substring(0, 100)}`)
                }
            })
        }
        
        // Step 7: Test Zimbra connection
        console.log('\n🔌 Step 6: Testing Zimbra Connection')
        console.log('-'.repeat(60))
        
        const testUser = users.find((u: any) => (u.ZIMBRA_SYNC_ENABLED || u.zimbra_sync_enabled) === 1)
        
        if (!testUser) {
            console.log('⚠️  Cannot test: No users have Zimbra sync enabled')
            console.log('   Solution: Enable sync for a user in Settings → Sync')
        } else {
            const testEmail = testUser.EMAIL || testUser.email
            console.log(`Testing with user: ${testEmail}`)
            
            try {
                const result = await createZimbraTaskViaAdminAPI(testEmail, {
                    title: `[TEST] Sync Test - ${new Date().toISOString()}`,
                    notes: 'This is a test task from NeoList diagnostics',
                    priority: 'Orta'
                })
                
                if (result.success) {
                    console.log('✅ SUCCESS! Task created in Zimbra')
                    console.log(`   Zimbra Task ID: ${result.taskId || result.uid}`)
                    console.log('\n   Please check Zimbra mail Tasks folder to verify!')
                } else {
                    console.log('❌ FAILED to create task in Zimbra')
                    console.log(`   Error: ${result.error}`)
                }
            } catch (e: any) {
                console.log('❌ EXCEPTION during Zimbra test')
                console.log(`   Error: ${e.message}`)
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(60))
        console.log('📊 DIAGNOSIS SUMMARY')
        console.log('='.repeat(60))
        
        const issues: string[] = []
        const solutions: string[] = []
        
        if (!process.env.ZIMBRA_ADMIN_EMAIL || !process.env.ZIMBRA_ADMIN_PASSWORD) {
            issues.push('❌ Zimbra credentials not configured')
            solutions.push('   Set ZIMBRA_ADMIN_EMAIL and ZIMBRA_ADMIN_PASSWORD in .env.local')
        }
        
        const enabledUsers = users.filter((u: any) => (u.ZIMBRA_SYNC_ENABLED || u.zimbra_sync_enabled) === 1)
        if (enabledUsers.length === 0) {
            issues.push('⚠️  No users have Zimbra sync enabled')
            solutions.push('   Enable sync: Settings → Sync → Enable Zimbra Sync')
        }
        
        const assignmentsWithZimbra = assignees.filter((a: any) => !!(a.ZIMBRA_TASK_ID || a.zimbra_task_id))
        if (assignees.length > 0 && assignmentsWithZimbra.length === 0) {
            issues.push('❌ Tasks exist but none have Zimbra IDs')
            solutions.push('   This means sync is not working. Check queue worker is running.')
        }
        
        const failedJobs = queueStats.find((s: any) => (s.STATUS || s.status) === 'FAILED')
        if (failedJobs) {
            issues.push(`⚠️  ${failedJobs.CNT || failedJobs.cnt} jobs failed in queue`)
            solutions.push('   Check error messages above for details')
        }
        
        if (issues.length === 0) {
            console.log('✅ No critical issues found!')
        } else {
            console.log('\nIssues Found:')
            issues.forEach(i => console.log(i))
            console.log('\nSuggested Solutions:')
            solutions.forEach(s => console.log(s))
        }
        
        console.log('\n💡 Next Steps:')
        console.log('   1. Ensure queue worker is running: npm run worker')
        console.log('   2. Check worker logs in logs/worker.log')
        console.log('   3. Create a new task and assign to a sync-enabled user')
        console.log('   4. Watch the queue: SELECT * FROM sync_queue ORDER BY created_at DESC')
        
    } catch (error: any) {
        console.error('\n❌ Diagnostic failed:', error.message)
        console.error(error.stack)
    } finally {
        await closePool()
    }
}

diagnose()
