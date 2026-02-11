# Zimbra Sync Issue - Diagnosis & Solution

**Date**: 2026-02-06  
**Issue**: Tasks created in NeoList don't appear in Zimbra mail  
**Status**: 🔴 CRITICAL - Root cause identified

---

## 🔍 Root Cause Analysis

Your NeoList application uses a **queue-based synchronization system** for Zimbra integration:

```
User creates task → Task assigned to user → Job added to sync_queue → Worker processes queue → Task appears in Zimbra
                                                                            ↑
                                                                      THIS IS THE ISSUE
```

### The Problem

**The Zimbra Queue Worker is not running!**

Your app has 3 PM2 processes defined in `ecosystem.config.js`:
1. ✅ `neolist` - Main Next.js app (probably running)
2. ❌ `zimbra-queue-worker` - **NOT RUNNING** (this processes sync jobs)
3. ❌ `zimbra-incoming-sync` - Optional (syncs FROM Zimbra TO NeoList)

When a task is created and assigned, it's added to the `sync_queue` database table with status `PENDING`, but without the worker running, these jobs are never processed!

---

## 📊 How the Sync Works

### 1. Task Assignment Flow
```typescript
// When user is assigned to a task in: src/app/api/task-assignees/route.ts

1. Check if user has zimbra_sync_enabled = 1
2. If yes, add job to sync_queue table:
   - action_type: 'CREATE'
   - status: 'PENDING'
   - payload: {task details}
   
3. Worker picks up PENDING jobs and:
   - Calls createZimbraTaskViaAdminAPI()
   - Updates task_assignees.zimbra_task_id
   - Marks job as 'COMPLETED'
```

### 2. Queue Worker (`scripts/services/queue_worker.ts`)
- Runs in infinite loop every 5 seconds
- Fetches PENDING jobs from sync_queue
- Processes CREATE/UPDATE/DELETE actions
- Handles retries (max 3 attempts)
- Stores zimbra_task_id back to database

### 3. User Settings
Users must have `profiles.zimbra_sync_enabled = 1` to sync tasks to their Zimbra account.

---

## ✅ Solution

### Step 1: Check PM2 Status

```bash
pm2 list
```

**Expected output:**
```
┌─────┬───────────────────────┬─────────┬─────────┐
│ id  │ name                  │ status  │ restart │
├─────┼───────────────────────┼─────────┼─────────┤
│ 0   │ neolist               │ online  │ 5       │
│ 1   │ zimbra-queue-worker   │ online  │ 0       │  ← MUST BE ONLINE
│ 2   │ zimbra-incoming-sync  │ online  │ 0       │
└─────┴───────────────────────┴─────────┴─────────┘
```

If `zimbra-queue-worker` is **NOT** in the list or is **stopped**:

### Step 2: Start the Queue Worker

```bash
# Start ALL services including worker
pm2 start ecosystem.config.js

# OR start only the worker
pm2 start ecosystem.config.js --only zimbra-queue-worker

# Check logs
pm2 logs zimbra-queue-worker
```

### Step 3: Process Existing Pending Jobs

If you already have tasks that didn't sync, they're sitting in the queue as PENDING:

```bash
# Check queue status
npx tsx -e "
import { executeQuery, getConnection, closePool } from './src/lib/oracle.js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function check() {
    await getConnection()
    const stats = await executeQuery(\`
        SELECT status, COUNT(*) as cnt 
        FROM sync_queue 
        GROUP BY status
    \`)
    console.log(stats)
    await closePool()
}
check()
"
```

Once the worker is running, it will automatically process all PENDING jobs.

### Step 4: Verify User Sync Settings

Ensure users have sync enabled:

```sql
-- Check user sync status
SELECT email, full_name, zimbra_sync_enabled, zimbra_last_sync 
FROM profiles 
WHERE email LIKE '%@optimed.com.tr%';

-- Enable sync for a user (if needed)
UPDATE profiles 
SET zimbra_sync_enabled = 1 
WHERE email = 'user@optimed.com.tr';
COMMIT;
```

Or use the UI: **Settings → Sync → Enable Zimbra Synchronization**

---

## 🧪 Testing the Fix

### 1. Run Diagnostic Script

```bash
npx tsx test-sync-issue.ts
```

This will:
- ✅ Check environment configuration
- ✅ Verify user sync settings
- ✅ Check task assignments and Zimbra IDs
- ✅ Inspect sync queue status
- ✅ Test Zimbra connection by creating a test task

### 2. Create Test Task

1. Log into NeoList
2. Create a new task
3. Assign it to a user with `zimbra_sync_enabled = 1`
4. Check the queue:

```bash
pm2 logs zimbra-queue-worker --lines 50
```

Expected output:
```
Processing Job <guid>: CREATE for user@optimed.com.tr
✓ Job <guid> Completed
```

5. Check Zimbra mail → Tasks folder → Task should appear!

### 3. Verify Database

```sql
-- Check if Zimbra ID was saved
SELECT ta.task_id, ta.user_id, ta.zimbra_task_id, t.title, p.email
FROM task_assignees ta
JOIN tasks t ON ta.task_id = t.id
JOIN profiles p ON ta.user_id = p.id
WHERE ta.zimbra_task_id IS NOT NULL
ORDER BY ta.assigned_at DESC
FETCH FIRST 10 ROWS ONLY;
```

If `zimbra_task_id` column has values, sync is working! ✅

---

## 🚨 Common Issues

### Issue 1: Worker starts but jobs fail

**Check worker logs:**
```bash
pm2 logs zimbra-queue-worker
```

**Common errors:**

1. **"Admin auth failed"**
   - Check ZIMBRA_ADMIN_EMAIL and ZIMBRA_ADMIN_PASSWORD in .env.local
   - Verify admin account has delegate rights in Zimbra

2. **"ECONNREFUSED port 7071"**
   - Zimbra admin port is blocked by firewall
   - Check: `Test-NetConnection webmail.optimed.com.tr -Port 7071`

3. **"Cannot locate Oracle Client"**
   - Oracle environment variables not set for PM2 process
   - Already configured in ecosystem.config.js (TNS_ADMIN, ORACLE_HOME)

### Issue 2: User has sync enabled but tasks still don't sync

Check:
1. ✅ User email matches Zimbra email exactly
2. ✅ Worker is running
3. ✅ No FAILED jobs in queue for that user
4. ✅ Admin credentials are correct

### Issue 3: Some tasks sync, others don't

```sql
-- Find failed jobs
SELECT task_id, user_email, error_message, retry_count
FROM sync_queue
WHERE status = 'FAILED'
ORDER BY created_at DESC;
```

Most failures are due to:
- Invalid Zimbra email
- Zimbra account doesn't exist
- Network timeout

---

## 🔧 Quick Fix Commands

```bash
# 1. Check what's running
pm2 list

# 2. Start the worker if not running
pm2 start ecosystem.config.js --only zimbra-queue-worker

# 3. Watch logs in real-time
pm2 logs zimbra-queue-worker --lines 100

# 4. Restart worker if needed
pm2 restart zimbra-queue-worker

# 5. Check queue from database
npx tsx scripts/debug/diagnose_sync.ts
```

---

## 📝 Summary Checklist

After starting the worker, verify:

- [ ] `pm2 list` shows `zimbra-queue-worker` as **online**
- [ ] Worker logs show "🚀 Zimbra Sync Worker Started"
- [ ] Create new task and assign to sync-enabled user
- [ ] Worker logs show "Processing Job" and "✓ Job Completed"
- [ ] Task appears in Zimbra mail Tasks folder
- [ ] Database has `zimbra_task_id` populated in `task_assignees` table
- [ ] No FAILED jobs in sync_queue

---

## 💡 Prevention

Add to startup/deployment checklist:

```bash
# After deployment, ALWAYS start all services
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Configure PM2 to start on system boot
```

Monitor queue health:
```sql
-- Add this as a monitoring query
SELECT 
    status,
    COUNT(*) as count,
    MAX(created_at) as last_job
FROM sync_queue
GROUP BY status;
```

Alert if:
- PENDING count > 100 (worker might be stuck)
- FAILED count > 50 (configuration issue)
- No COMPLETED jobs in last hour (worker not running)

---

## 📚 Related Files

- `ecosystem.config.js` - PM2 process configuration
- `scripts/services/queue_worker.ts` - Worker implementation
- `src/lib/zimbra-sync.ts` - Zimbra API client
- `src/app/api/task-assignees/route.ts` - Where jobs are queued
- `migrations/012_add_zimbra_task_id.sql` - Database schema for sync
- `migrations/003_selective_sync_cols.sql` - User sync settings

---

**Next Step**: Run diagnostic and start the worker! 🚀
