import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool, executeQuery, executeNonQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const CANDIDATE_UNIT_TITLES = [
    'Bilgi İşlem',
    'METİN',
    'EMİNE',
    'LABORATUVAR',
    'Genel',
    'Kalite',
    'Hasta Hakları',
    'İşletmenin Yönetimi',
    'Biyomedikal',
    'Uluslararası Hasta Hizmetleri',
    'kurumsal',
    'Satınalma',
    'Muhasebe'
]

function norm(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
}

function getValue<T = any>(row: any, key: string): T {
    return (row?.[key] ?? row?.[key.toUpperCase()]) as T
}

async function main() {
    await initializePool()

    const zimbraRoots = await executeQuery(
        `SELECT id, title
         FROM folders
         WHERE parent_id IS NULL`
    )

    const rootIds = zimbraRoots
        .filter((row) => norm(String(getValue(row, 'title') || '')).includes('zimbra gorevleri'))
        .map((row) => String(getValue(row, 'id')))

    if (rootIds.length === 0) {
        console.log('No Zimbra root folders found.')
        return
    }

    const placeholders = rootIds.map((_, index) => `:r${index}`).join(', ')
    const params: Record<string, string> = {}
    rootIds.forEach((id, index) => {
        params[`r${index}`] = id
    })

    const children = await executeQuery(
        `SELECT id, title, parent_id
         FROM folders
         WHERE parent_id IN (${placeholders})`,
        params
    )

    const titleNormSet = new Set(CANDIDATE_UNIT_TITLES.map((item) => norm(item)))

    const candidates = children.filter((row) => {
        const title = String(getValue(row, 'title') || '')
        return titleNormSet.has(norm(title))
    })

    let deleted = 0
    let skipped = 0

    for (const folder of candidates) {
        const folderId = String(getValue(folder, 'id'))
        const title = String(getValue(folder, 'title'))

        const listCountRows = await executeQuery(
            `SELECT COUNT(*) AS cnt FROM lists WHERE folder_id = :id`,
            { id: folderId }
        )
        const childCountRows = await executeQuery(
            `SELECT COUNT(*) AS cnt FROM folders WHERE parent_id = :id`,
            { id: folderId }
        )

        const listCount = Number(getValue(listCountRows[0], 'cnt') || 0)
        const childCount = Number(getValue(childCountRows[0], 'cnt') || 0)

        if (listCount > 0 || childCount > 0) {
            skipped++
            continue
        }

        await executeNonQuery(`DELETE FROM folder_members WHERE folder_id = :id`, { id: folderId })
        await executeNonQuery(`DELETE FROM folders WHERE id = :id`, { id: folderId })
        deleted++
        console.log(`- Removed '${title}' from Zimbra root (empty)`)
    }

    console.log('--- Cleanup Summary ---')
    console.log(`Zimbra roots: ${rootIds.length}`)
    console.log(`Candidates checked: ${candidates.length}`)
    console.log(`Deleted: ${deleted}`)
    console.log(`Skipped (not empty): ${skipped}`)
}

main()
    .catch((error) => {
        console.error('cleanup_wrong_zimbra_units failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
