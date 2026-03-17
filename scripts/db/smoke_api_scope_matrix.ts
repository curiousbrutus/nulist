import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool, executeQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function getValue<T = any>(row: any, key: string): T {
    return (row?.[key] ?? row?.[key.toUpperCase()]) as T
}

async function pickUser(role: string) {
    const rows = await executeQuery(
        `SELECT id, full_name, email, role
         FROM profiles
         WHERE role = :role
         ORDER BY full_name ASC NULLS LAST
         FETCH FIRST 1 ROWS ONLY`,
        { role }
    )
    return rows[0] || null
}

async function folderCount(userId: string, isPrivileged: number) {
    const rows = await executeQuery(
        `SELECT COUNT(*) AS cnt
         FROM folders f
         LEFT JOIN folders pf ON pf.id = f.parent_id
         WHERE (
            :is_privileged = 1
            OR f.user_id = :user_id
            OR f.id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
            OR EXISTS (
                SELECT 1
                FROM user_departments ud
                JOIN departments d ON d.id = ud.department_id
                JOIN facilities fac ON fac.id = d.facility_id
                WHERE ud.user_id = :user_id
                  AND (
                    UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                    OR UPPER(TRIM(NVL(pf.title, ''))) = UPPER(TRIM(d.name))
                  )
                  AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
            )
         )`,
        { user_id: userId, is_privileged: isPrivileged }
    )
    return Number(getValue(rows[0], 'cnt') || 0)
}

async function listCount(userId: string, isPrivileged: number) {
    const rows = await executeQuery(
        `SELECT COUNT(*) AS cnt
         FROM lists l
         JOIN folders f ON f.id = l.folder_id
         LEFT JOIN folders pf ON pf.id = f.parent_id
         WHERE (
            :is_privileged = 1
            OR f.user_id = :user_id
            OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
            OR EXISTS (
                SELECT 1
                FROM user_departments ud
                JOIN departments d ON d.id = ud.department_id
                JOIN facilities fac ON fac.id = d.facility_id
                WHERE ud.user_id = :user_id
                  AND (
                    UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                    OR UPPER(TRIM(NVL(pf.title, ''))) = UPPER(TRIM(d.name))
                  )
                  AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
            )
         )`,
        { user_id: userId, is_privileged: isPrivileged }
    )
    return Number(getValue(rows[0], 'cnt') || 0)
}

async function taskCount(userId: string, isPrivileged: number) {
    const rows = await executeQuery(
        `SELECT COUNT(*) AS cnt
         FROM tasks t
         JOIN lists l ON t.list_id = l.id
         JOIN folders f ON l.folder_id = f.id
         LEFT JOIN folders pf ON pf.id = f.parent_id
         WHERE (
            :is_privileged = 1
            OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = :user_id)
            OR t.created_by = :user_id
            OR f.user_id = :user_id
            OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = :user_id)
            OR EXISTS (
                SELECT 1
                FROM user_departments ud
                JOIN departments d ON d.id = ud.department_id
                JOIN facilities fac ON fac.id = d.facility_id
                WHERE ud.user_id = :user_id
                  AND (
                    UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                    OR UPPER(TRIM(NVL(pf.title, ''))) = UPPER(TRIM(d.name))
                  )
                  AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
            )
         )`,
        { user_id: userId, is_privileged: isPrivileged }
    )
    return Number(getValue(rows[0], 'cnt') || 0)
}

async function main() {
    await initializePool()

    const actors = [
        { label: 'superadmin', row: await pickUser('superadmin'), privileged: 1 },
        { label: 'admin', row: await pickUser('admin'), privileged: 1 },
        { label: 'user', row: await pickUser('user'), privileged: 0 }
    ]

    const matrix: any[] = []
    for (const actor of actors) {
        if (!actor.row) {
            matrix.push({ role_label: actor.label, status: 'missing-user' })
            continue
        }

        const userId = String(getValue(actor.row, 'id'))
        matrix.push({
            role_label: actor.label,
            user_id: userId,
            full_name: String(getValue(actor.row, 'full_name') || ''),
            email: String(getValue(actor.row, 'email') || ''),
            folders_visible: await folderCount(userId, actor.privileged),
            lists_visible: await listCount(userId, actor.privileged),
            tasks_visible: await taskCount(userId, actor.privileged),
            status: 'ok'
        })
    }

    console.log('--- API Scope Smoke Matrix ---')
    console.table(matrix)
}

main()
    .catch((error) => {
        console.error('smoke_api_scope_matrix failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
