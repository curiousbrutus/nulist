import { NextRequest, NextResponse } from 'next/server';
import { getOracleConnection } from '@/lib/oracle';
import { auth } from '@/auth';
import { v4 as uuidv4 } from 'uuid';

// Helper to create slug/code from name
function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, defaultFolder, defaultList } = await req.json();

    if (!data) {
        return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    let connection;

    try {
        connection = await getOracleConnection();

        // 1. Set Session Context (VPD)
        await connection.execute(
            `BEGIN pkg_session_mgr.set_user(:uid); END;`,
            { uid: session.user.id }
        );

        const lines = data.split('\n').filter((l: string) => l.trim().length > 0);
        const results = {
            processed: 0,
            created_tasks: 0,
            errors: [] as string[]
        };

        const startIndex = lines[0].includes('SIRA') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.split('\t');

            try {
                const rowData = {
                    legacy_id: cols[0]?.trim(),
                    date_str: cols[1]?.trim(),
                    location_list: cols[2]?.trim(),
                    task_content: cols[3]?.trim(),
                    primary_owner: cols[4]?.trim(),
                    secondary_owner: cols[5]?.trim(),
                    due_date_str: cols[6]?.trim(),
                    note: cols[7]?.trim(),
                    completed_date_str: cols[8]?.trim(),
                    status_str: cols[9]?.trim()
                };

                const parseDate = (d: string) => {
                    if (!d) return null;
                    const parts = d.split('.');
                    if (parts.length < 3) return null;
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }

                const meetingDate = parseDate(rowData.date_str);
                const dueDate = parseDate(rowData.due_date_str);
                // const completedDate = parseDate(rowData.completed_date_str);

                let folderName = defaultFolder || "Genel";
                let listName = defaultList || "İş Listesi";

                if (rowData.location_list) {
                    const parts = rowData.location_list.split(/[\n\r]+/);
                    if (parts.length >= 2) {
                        folderName = parts[0].trim();
                        listName = parts[1].trim();
                    } else if (rowData.location_list.includes('Çorlu Optimed Hastanesi')) {
                        folderName = 'Çorlu Optimed Hastanesi';
                        listName = rowData.location_list.replace('Çorlu Optimed Hastanesi', '').trim() || 'İşletmenin Yönetimi İş Listesi';
                    } else {
                        folderName = parts[0].trim();
                    }
                }
                if (folderName.length < 2) folderName = "Genel";

                // 1. Find/Create Folder
                let folderId;
                const folderRes = await connection.execute(
                    `SELECT id FROM folders WHERE title = :1 AND user_id = :2`,
                    [folderName, session.user.id]
                );
                if (folderRes.rows && folderRes.rows.length > 0) {
                    folderId = (folderRes.rows[0] as any)[0];
                } else {
                    folderId = uuidv4();
                    await connection.execute(
                        `INSERT INTO folders (id, user_id, title) VALUES (:1, :2, :3)`,
                        [folderId, session.user.id, folderName],
                        { autoCommit: true }
                    );
                }

                // 2. Find/Create List
                let listId;
                const listRes = await connection.execute(
                    `SELECT id FROM lists WHERE title = :1 AND folder_id = :2`,
                    [listName, folderId]
                );
                if (listRes.rows && listRes.rows.length > 0) {
                    listId = (listRes.rows[0] as any)[0];
                } else {
                    listId = uuidv4();
                    await connection.execute(
                        `INSERT INTO lists (id, folder_id, title) VALUES (:1, :2, :3)`,
                        [listId, folderId, listName],
                        { autoCommit: true }
                    );
                }

                // 3. Create Task
                const taskId = uuidv4();
                let status = 'pending';
                if (rowData.status_str?.toLowerCase().includes('tamam')) status = 'completed';

                await connection.execute(
                    `INSERT INTO tasks (
                    "ID", "LIST_ID", "TITLE", "LEGACY_ID", "MEETING_DATE", "DUE_DATE", "NOTES", "CREATED_BY", "STATUS"
                ) VALUES (
                   :1, :2, :3, :4, :5, :6, :7, :8, :9
                )`,
                    [
                        taskId,
                        listId,
                        rowData.task_content || 'Adsız Görev',
                        rowData.legacy_id || null,
                        meetingDate || null,
                        dueDate || null,
                        rowData.note || null,
                        session.user.id,
                        status
                    ],
                    { autoCommit: true }
                );

                // 4. Handle Assignees
                const handleAssignee = async (name: string, role: 'primary' | 'secondary') => {
                    if (!name || name === '-') return;

                    const names = name.split(/[,&]+/).map(n => n.trim());

                    for (const personName of names) {
                        if (personName.length < 2) continue;
                        // Find user by name
                        let userId;
                        const userRes = await connection.execute(
                            `SELECT id FROM profiles WHERE UPPER(full_name) = UPPER(:1)`,
                            [personName]
                        );

                        if (userRes.rows && userRes.rows.length > 0) {
                            userId = (userRes.rows[0] as any)[0];
                        } else {
                            // Create phantom/placeholder user
                            userId = uuidv4();
                            const placeholderEmail = slugify(personName) + '@temp.local';

                            await connection.execute(
                                `INSERT INTO profiles (id, email, full_name, password_hash) 
                             VALUES (:1, :2, :3, 'PLACEHOLDER')`,
                                [userId, placeholderEmail, personName],
                                { autoCommit: true }
                            );
                        }

                        // Assign
                        try {
                            await connection.execute(
                                `INSERT INTO task_assignees (task_id, user_id, responsibility_role) 
                             VALUES (:1, :2, :3)`,
                                [taskId, userId, role],
                                { autoCommit: true }
                            );
                        } catch (e) { }
                    }
                };

                await handleAssignee(rowData.primary_owner, 'primary');
                await handleAssignee(rowData.secondary_owner, 'secondary');

                results.created_tasks++;

            } catch (rowError: any) {
                results.errors.push(`Row ${i}: ${rowError.message}`);
            }
        }

        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Import error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}
