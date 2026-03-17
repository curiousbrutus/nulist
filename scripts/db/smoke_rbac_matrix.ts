import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool, executeQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

type ProfileRow = {
    id: string
    full_name?: string
    email?: string
    role?: string
    branch?: string
}

function getValue<T = any>(row: any, key: string): T {
    return (row?.[key] ?? row?.[key.toUpperCase()]) as T
}

async function pickRoleUser(role: string): Promise<ProfileRow | null> {
    const rows = await executeQuery(
        `SELECT id, full_name, email, role, branch
         FROM profiles
         WHERE role = :role
         ORDER BY full_name ASC NULLS LAST, email ASC NULLS LAST
         FETCH FIRST 1 ROWS ONLY`,
        { role }
    )

    if (!rows || rows.length === 0) return null

    const row = rows[0]
    return {
        id: String(getValue(row, 'id')),
        full_name: String(getValue(row, 'full_name') || ''),
        email: String(getValue(row, 'email') || ''),
        role: String(getValue(row, 'role') || ''),
        branch: String(getValue(row, 'branch') || '')
    }
}

async function pickManagerUser(): Promise<ProfileRow | null> {
    const rows = await executeQuery(
        `SELECT p.id, p.full_name, p.email, p.role, p.branch
         FROM profiles p
         WHERE p.role = 'user'
           AND EXISTS (
             SELECT 1
             FROM profiles c
             WHERE c.manager_id = p.id
           )
         ORDER BY p.full_name ASC NULLS LAST, p.email ASC NULLS LAST
         FETCH FIRST 1 ROWS ONLY`
    )

    if (!rows || rows.length === 0) return null

    const row = rows[0]
    return {
        id: String(getValue(row, 'id')),
        full_name: String(getValue(row, 'full_name') || ''),
        email: String(getValue(row, 'email') || ''),
        role: String(getValue(row, 'role') || ''),
        branch: String(getValue(row, 'branch') || '')
    }
}

async function pickRegularUser(excludeIds: string[]): Promise<ProfileRow | null> {
    const placeholders = excludeIds.map((_, idx) => `:e${idx}`).join(', ')
    const params: Record<string, string> = {}
    excludeIds.forEach((id, idx) => {
        params[`e${idx}`] = id
    })

    const sql = excludeIds.length > 0
        ? `SELECT id, full_name, email, role, branch
           FROM profiles
           WHERE role = 'user'
             AND id NOT IN (${placeholders})
           ORDER BY full_name ASC NULLS LAST, email ASC NULLS LAST
           FETCH FIRST 1 ROWS ONLY`
        : `SELECT id, full_name, email, role, branch
           FROM profiles
           WHERE role = 'user'
           ORDER BY full_name ASC NULLS LAST, email ASC NULLS LAST
           FETCH FIRST 1 ROWS ONLY`

    const rows = await executeQuery(sql, params)
    if (!rows || rows.length === 0) return null

    const row = rows[0]
    return {
        id: String(getValue(row, 'id')),
        full_name: String(getValue(row, 'full_name') || ''),
        email: String(getValue(row, 'email') || ''),
        role: String(getValue(row, 'role') || ''),
        branch: String(getValue(row, 'branch') || '')
    }
}

async function countForUser(userId: string, sql: string, params: Record<string, any> = {}) {
    const rows = await executeQuery(sql, params, userId)
    return Number(getValue(rows?.[0], 'cnt') || 0)
}

async function buildMetrics(user: ProfileRow) {
    const folders = await countForUser(user.id, `SELECT COUNT(*) AS cnt FROM folders`)
    const lists = await countForUser(user.id, `SELECT COUNT(*) AS cnt FROM lists`)
    const tasks = await countForUser(user.id, `SELECT COUNT(*) AS cnt FROM tasks`)
    const comments = await countForUser(user.id, `SELECT COUNT(*) AS cnt FROM comments`)
    const attachments = await countForUser(user.id, `SELECT COUNT(*) AS cnt FROM task_attachments`)
    const assignees = await countForUser(user.id, `SELECT COUNT(*) AS cnt FROM task_assignees`)
    const folderMembers = await countForUser(user.id, `SELECT COUNT(*) AS cnt FROM folder_members`)

    const assignableLists = await countForUser(
        user.id,
        `SELECT COUNT(DISTINCT l.id) AS cnt
         FROM lists l
         JOIN folders f ON f.id = l.folder_id
            LEFT JOIN folders pf ON pf.id = f.parent_id
         LEFT JOIN folder_members fm
           ON fm.folder_id = f.id
                     AND fm.user_id = :user_id
         LEFT JOIN profiles p
                     ON p.id = :user_id
         WHERE (
            p.role IN ('admin', 'superadmin')
                        OR f.user_id = :user_id
            OR NVL(fm.can_assign_task, 0) = 1
            OR NVL(fm.can_add_task, 0) = 1
            OR NVL(fm.can_delete_task, 0) = 1
            OR (
                p.role = 'secretary'
                AND p.branch IS NOT NULL
                AND (
                    UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(p.branch))
                    OR UPPER(TRIM(p.branch)) = UPPER(TRIM('Tüm Şubeler'))
                )
            )
         )`,
        { user_id: user.id }
    )

    return {
        folders,
        lists,
        tasks,
        comments,
        attachments,
        assignees,
        folderMembers,
        assignableLists
    }
}

async function main() {
    await initializePool()

    const superadmin = await pickRoleUser('superadmin')
    const admin = await pickRoleUser('admin')
    const secretary = await pickRoleUser('secretary')
    const managerUser = await pickManagerUser()

    const exclude = [superadmin?.id, admin?.id, secretary?.id, managerUser?.id].filter(Boolean) as string[]
    const regularUser = await pickRegularUser(exclude)

    const actors = [
        { label: 'superadmin', user: superadmin },
        { label: 'admin', user: admin },
        { label: 'secretary', user: secretary },
        { label: 'manager-user', user: managerUser },
        { label: 'regular-user', user: regularUser }
    ]

    const matrix: any[] = []

    for (const actor of actors) {
        if (!actor.user) {
            matrix.push({ role_label: actor.label, status: 'missing-user' })
            continue
        }

        const metrics = await buildMetrics(actor.user)
        matrix.push({
            role_label: actor.label,
            user_id: actor.user.id,
            full_name: actor.user.full_name,
            email: actor.user.email,
            role: actor.user.role,
            branch: actor.user.branch,
            ...metrics,
            status: 'ok'
        })
    }

    const totals = {
        folders: Number(getValue((await executeQuery(`SELECT COUNT(*) AS cnt FROM folders`))[0], 'cnt') || 0),
        lists: Number(getValue((await executeQuery(`SELECT COUNT(*) AS cnt FROM lists`))[0], 'cnt') || 0),
        tasks: Number(getValue((await executeQuery(`SELECT COUNT(*) AS cnt FROM tasks`))[0], 'cnt') || 0),
        comments: Number(getValue((await executeQuery(`SELECT COUNT(*) AS cnt FROM comments`))[0], 'cnt') || 0),
        attachments: Number(getValue((await executeQuery(`SELECT COUNT(*) AS cnt FROM task_attachments`))[0], 'cnt') || 0),
        assignees: Number(getValue((await executeQuery(`SELECT COUNT(*) AS cnt FROM task_assignees`))[0], 'cnt') || 0),
        folderMembers: Number(getValue((await executeQuery(`SELECT COUNT(*) AS cnt FROM folder_members`))[0], 'cnt') || 0)
    }

    console.log('--- RBAC Smoke Totals (raw tables) ---')
    console.table([totals])
    console.log('--- RBAC Smoke Matrix (VPD scoped per role) ---')
    console.table(matrix)
}

main()
    .catch((error) => {
        console.error('smoke_rbac_matrix failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
