# 🚨 ZIMBRA SYNC NOT WORKING - QUICK FIX

## THE PROBLEM
Tasks in NeoList don't show up in Zimbra mail.

## THE CAUSE
**The Zimbra Queue Worker is not running!**

Your app uses a queue system:
```
Task created → Added to sync_queue → Worker processes it → Appears in Zimbra
                                          ↑
                                     NOT RUNNING!
```

## THE FIX (3 Simple Steps)

### Step 1: Check if worker is running
Double-click: **`check-pm2.bat`**

You should see:
```
┌─────┬───────────────────────┬─────────┐
│ id  │ name                  │ status  │
├─────┼───────────────────────┼─────────┤
│ 0   │ neolist               │ online  │
│ 1   │ zimbra-queue-worker   │ online  │  ← THIS MUST BE ONLINE!
│ 2   │ zimbra-incoming-sync  │ online  │
└─────┴───────────────────────┴─────────┘
```

If `zimbra-queue-worker` is **missing** or **stopped**, continue to Step 2.

### Step 2: Start the worker
Double-click: **`fix-zimbra-sync.bat`**

Choose option **1** (Start ALL services) or **2** (Start worker only)

### Step 3: Test it!
1. Create a new task in NeoList
2. Assign it to a user who has **Zimbra Sync Enabled** in Settings
3. Wait 5-10 seconds
4. Check Zimbra mail → **Tasks** folder
5. The task should appear! ✅

---

## IMPORTANT: User Settings

Users must enable Zimbra sync:
- Go to **Settings → Sync**
- Turn on **"Enable Zimbra Synchronization"**
- Click **Save**

Check who has sync enabled:
```sql
SELECT email, full_name, zimbra_sync_enabled 
FROM profiles;
```

Enable for a user:
```sql
UPDATE profiles 
SET zimbra_sync_enabled = 1 
WHERE email = 'user@optimed.com.tr';
COMMIT;
```

---

## HOW TO VERIFY IT'S WORKING

### Method 1: Check Worker Logs
Double-click: `fix-zimbra-sync.bat` → Choose option **3**

You should see:
```
🚀 Zimbra Sync Worker Started
Processing Job <id>: CREATE for user@optimed.com.tr
✓ Job <id> Completed
```

### Method 2: Check Database
```sql
-- See recent sync jobs
SELECT task_id, user_email, action_type, status, created_at
FROM sync_queue
ORDER BY created_at DESC
FETCH FIRST 10 ROWS ONLY;
```

Status should be **COMPLETED**, not PENDING or FAILED.

```sql
-- See tasks that were synced to Zimbra
SELECT t.title, p.email, ta.zimbra_task_id
FROM task_assignees ta
JOIN tasks t ON ta.task_id = t.id
JOIN profiles p ON ta.user_id = p.id
WHERE ta.zimbra_task_id IS NOT NULL
ORDER BY ta.assigned_at DESC
FETCH FIRST 10 ROWS ONLY;
```

If `zimbra_task_id` has values, it's working! ✅

---

## TROUBLESHOOTING

### Problem: Worker keeps restarting
Check logs: `pm2 logs zimbra-queue-worker`

Common issues:
- ❌ Oracle connection failed → Check TNS_ADMIN environment variable
- ❌ Zimbra auth failed → Check ZIMBRA_ADMIN_EMAIL and ZIMBRA_ADMIN_PASSWORD in `.env.local`

### Problem: Jobs go to FAILED status
```sql
SELECT error_message FROM sync_queue WHERE status = 'FAILED';
```

Common errors:
- "Admin auth failed" → Wrong admin credentials
- "ECONNREFUSED" → Firewall blocking port 7071
- "User not found" → Email mismatch between NeoList and Zimbra

### Problem: Worker is running but queue is stuck on PENDING
```sql
SELECT COUNT(*) FROM sync_queue WHERE status = 'PENDING';
```

If count keeps growing:
- Restart worker: `pm2 restart zimbra-queue-worker`
- Check Oracle connection
- Check Zimbra admin credentials

---

## DIAGNOSTIC SCRIPT

For detailed diagnosis, double-click: **`fix-zimbra-sync.bat`** → Choose option **4**

This will:
✅ Check environment configuration
✅ Check user sync settings
✅ Inspect sync queue
✅ Test Zimbra connection
✅ Create a test task in Zimbra

---

## QUICK REFERENCE

| File | Purpose |
|------|---------|
| `check-pm2.bat` | Check if worker is running |
| `fix-zimbra-sync.bat` | Start worker and access tools |
| `test-sync-issue.ts` | Diagnostic script |
| `SYNC_ISSUE_DIAGNOSIS.md` | Complete technical documentation |
| `ecosystem.config.js` | PM2 configuration |
| `scripts/services/queue_worker.ts` | Worker source code |

---

## PREVENTION

After every server restart or deployment:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Configure auto-start on boot
```

Or add to Windows Task Scheduler to run on startup:
```
Program: pm2
Arguments: resurrect
Start in: C:\Users\Administrator\Desktop\neolist
Trigger: At startup
```

---

**Need more help?** Read the detailed guide: `SYNC_ISSUE_DIAGNOSIS.md`

**Still not working?** Check worker logs: `pm2 logs zimbra-queue-worker`
