
import { getConnection, closePool, executeQuery, executeNonQuery } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function createManualTask() {
    try {
        await getConnection()
        console.log("✅ Oracle Connection Established");
        
        const targetEmail = 'metehanceylan@optimed.com.tr';
        const taskTitle = 'püskevit';
        const taskPriority = 'Acil';
        
        // Calculate End of Feb 2026
        const dueDate = new Date('2026-02-28T17:00:00'); 

        console.log(`Finding user: ${targetEmail}...`);
        // executeQuery returns an array of objects (T[])
        const userRows = await executeQuery(`SELECT id, email FROM profiles WHERE email = :email`, { email: targetEmail });
        
        if (!userRows || userRows.length === 0) {
            throw new Error(`User ${targetEmail} not found!`);
        }
        
        // Rows are objects with lowercase keys due to cleanOracleObject
        const userId = (userRows[0] as any).id; 
        console.log(`User found: ${userId}`);

        // --- 1. Find or Create Folder ---
        console.log("Looking for user folders...");
        const folderRows = await executeQuery(
            `SELECT id FROM folders WHERE user_id = :param_uid ORDER BY created_at ASC FETCH FIRST 1 ROWS ONLY`,
            { param_uid: userId }
        );

        let folderId;
        if (folderRows && folderRows.length > 0) {
            folderId = (folderRows[0] as any).id;
            console.log(`Using existing folder: ${folderId}`);
        } else {
            console.log("No folder found. Creating 'Genel' folder...");
            folderId = uuidv4();
            await executeNonQuery(
                `INSERT INTO folders (id, user_id, title) VALUES (:param_fid, :param_uid, 'Genel')`,
                { param_fid: folderId, param_uid: userId }
            );
        }

        // --- 2. Find or Create List ---
        console.log(`Looking for lists in folder ${folderId}...`);
        const listRows = await executeQuery(
            `SELECT id FROM lists WHERE folder_id = :param_fid ORDER BY created_at ASC FETCH FIRST 1 ROWS ONLY`,
            { param_fid: folderId }
        );

        let listId;
        if (listRows && listRows.length > 0) {
            listId = (listRows[0] as any).id;
            console.log(`Using existing list: ${listId}`);
        } else {
            console.log("No list found. Creating 'Genel' list...");
            listId = uuidv4();
            await executeNonQuery(
                `INSERT INTO lists (id, folder_id, title) VALUES (:param_lid, :param_fid, 'Genel')`,
                { param_lid: listId, param_fid: folderId }
            );
        }
        
        // --- 3. Create Task ---
        const taskId = uuidv4();
        console.log(`Creating task: ${taskTitle} (ID: ${taskId})...`);
        
        await executeNonQuery(
            `INSERT INTO tasks (id, list_id, title, priority, due_date, status, created_by) 
             VALUES (:val_id, :val_lid, :val_title, :val_prio, :val_due, 'pending', :val_uid)`,
            { 
                val_id: taskId, 
                val_lid: listId,
                val_title: taskTitle, 
                val_prio: taskPriority, 
                val_due: dueDate,
                val_uid: userId 
            }
        );

        // --- 4. Assign Task ---
        console.log(`Assigning task...`);
        await executeNonQuery(
            `INSERT INTO task_assignees (task_id, user_id) VALUES (:val_tid, :val_uid)`,
            { val_tid: taskId, val_uid: userId }
        );

        // --- 5. Queue Job ---
        console.log(`Queuing Zimbra sync job...`);
        
        const payload = JSON.stringify({
            title: taskTitle,
            notes: 'Manuel oluşturuldu (AI Agent) - Püskevit Testi',
            priority: taskPriority,
            due_date: dueDate.toISOString(),
            status: 'NEEDS-ACTION',
            folderId: listId, 
            internalId: taskId
        });

        await executeNonQuery(
            `INSERT INTO sync_queue (id, task_id, user_email, action_type, payload, status)
             VALUES (SYS_GUID(), :val_tid, :val_uemail, 'CREATE', :val_payload, 'PENDING')`,
            { 
                val_tid: taskId, 
                val_uemail: targetEmail, 
                val_payload: payload 
            }
        );

        console.log(`✅ Success! Task "${taskTitle}" created & queued for ${targetEmail}.`);
        console.log("Monitor sync_queue table or logs for processing.");

    } catch(e) { 
        console.error("❌ Error:", e) 
    } finally {
        await closePool()
        console.log("✅ Connection closed.");
    }
}

createManualTask()
