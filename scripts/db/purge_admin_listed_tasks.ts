import dotenv from 'dotenv'
import path from 'path'
import { closePool, executeNonQuery, executeQuery, initializePool } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const TARGET_FOLDER = 'Zimbra Görevleri'

const targets = [
    { title: 'deneme11022026', assigneeLike: 'Hüseyin Aydın' },
    { title: 'DENEME GÖREV', assigneeLike: 'Metehan Ceylan' },
    { title: 'eyoş', assigneeLike: 'Buket Sahin' },
    { title: 'deneme11022026', assigneeLike: 'Arzu Ceren' },
    { title: 'Untitled Task', assigneeLike: 'Metin Çakmak' },
    { title: 'puskevit', assigneeLike: 'Metin Çakmak' },
    { title: 'Untitled Task', assigneeLike: 'Eyyüb Güven' },
    { title: 'deneme', assigneeLike: 'Eyyüb Güven' },
    { title: 'deneme görev Ezgi hanım', assigneeLike: 'Eyyüb Güven' },
    { title: 'Untitled Task', assigneeLike: 'Emine' },
    { title: 'test', assigneeLike: 'Fatih Sak' },
    { title: 'test deneme', assigneeLike: 'Fatih Sak' }
]

function normalize(text: any) {
    return String(text || '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
}

async function main() {
    await initializePool()

    const rows = await executeQuery(
        `SELECT DISTINCT
            t.id AS task_id,
            t.title,
            f.title AS folder_title,
            p.full_name AS assignee_name,
            p.email AS assignee_email,
            ta.zimbra_task_id
         FROM tasks t
         JOIN lists l ON l.id = t.list_id
         JOIN folders f ON f.id = l.folder_id
         LEFT JOIN task_assignees ta ON ta.task_id = t.id
         LEFT JOIN profiles p ON p.id = ta.user_id
         WHERE f.title = :folder_title`,
        { folder_title: TARGET_FOLDER }
    )

    const candidates = rows.filter((row: any) => {
        const title = normalize(row.title || row.TITLE)
        const assignee = normalize(row.assignee_name || row.ASSIGNEE_NAME || row.assignee_email || row.ASSIGNEE_EMAIL)

        return targets.some((target) => {
            const targetTitle = normalize(target.title)
            const targetAssignee = normalize(target.assigneeLike)
            return title === targetTitle && assignee.includes(targetAssignee)
        })
    })

    const taskIds = Array.from(new Set(candidates.map((c: any) => String(c.task_id || c.TASK_ID))))

    console.log(`Found ${taskIds.length} matching tasks in ${TARGET_FOLDER}`)
    if (taskIds.length === 0) {
        return
    }

    for (const c of candidates) {
        console.log(`- ${c.task_id || c.TASK_ID} | ${c.title || c.TITLE} | ${c.assignee_name || c.ASSIGNEE_NAME || c.assignee_email || c.ASSIGNEE_EMAIL}`)
    }

    const placeholders = taskIds.map((_, i) => `:id${i}`).join(', ')
    const bindParams: Record<string, string> = {}
    taskIds.forEach((id, i) => {
        bindParams[`id${i}`] = id
    })

    await executeNonQuery(`DELETE FROM task_assignees WHERE task_id IN (${placeholders})`, bindParams)
    await executeNonQuery(`DELETE FROM tasks WHERE id IN (${placeholders})`, bindParams)

    console.log(`Deleted ${taskIds.length} tasks (+ related assignees).`)
}

main()
    .catch((error) => {
        console.error('❌ purge_admin_listed_tasks failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
