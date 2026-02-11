
import { executeQuery, executeNonQuery, initializePool } from '../src/lib/oracle';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function fixMerve() {
    await initializePool();
    
    // Find Merve User
    const merve = await executeQuery(`SELECT id, email FROM profiles WHERE email LIKE 'merve%'`);
    if (!merve.length) {
        console.error('Merve not found');
        return;
    }
    const merveId = merve[0].id;
    const merveEmail = merve[0].email;
    console.log(`Found Merve: ${merveEmail}`);

    // Enable Sync
    await executeNonQuery(`UPDATE profiles SET zimbra_sync_enabled = 1 WHERE id = :id`, { id: merveId });

    // Task 229 - Acil müdehale...
    const t229 = await executeQuery(`SELECT id, title, notes, due_date FROM tasks WHERE title LIKE 'Acil m%dehale odas%n%n%'`);
    if (t229.length) {
        const t = t229[0];
        console.log(`Fixing Task 229: ${t.title}`);
        await addAssignee(t.id, merveId);
        await queueSync(t.id, merveEmail, t);
    } else {
        console.log('Task 229 not found');
    }

    // Task 324 - AACI belgesinin...
    const t324 = await executeQuery(`SELECT id, title, notes, due_date FROM tasks WHERE title LIKE 'AACI belgesinin%'`);
    if (t324.length) {
        const t = t324[0];
        console.log(`Fixing Task 324: ${t.title}`);
        await addAssignee(t.id, merveId);
        await queueSync(t.id, merveEmail, t);
    } else {
         console.log('Task 324 not found');
    }

    process.exit(0);
}

async function addAssignee(taskId: string, userId: string) {
    try {
        await executeNonQuery(`INSERT INTO task_assignees (task_id, user_id) VALUES (:bv_tid, :bv_uid)`, { bv_tid: taskId, bv_uid: userId });
        console.log('Assignee added');
    } catch (e: any) {
        if (e.message.includes('unique constraint')) {
            console.log('Assignee already exists');
        } else {
            console.error('Add Assignee Error:', e);
        }
    }
}

async function queueSync(taskId: string, email: string, task: any) {
    await executeNonQuery(`
        INSERT INTO sync_queue (id, task_id, user_email, action_type, payload, status)
        VALUES (:id, :tid, :email, 'CREATE', :payload, 'PENDING')
     `, {
         id: uuidv4(),
         tid: taskId,
         email: email,
         payload: JSON.stringify({
             title: task.title,
             notes: task.notes || '',
             due_date: task.due_date,
             priority: 'Orta',
             status: 'NEEDS-ACTION'
         })
     });
     console.log(`Queued sync for ${email}`);
}

fixMerve();
