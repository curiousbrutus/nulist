import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool, executeQuery, executeNonQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function norm(value: string) {
    return value
        .replace(/[İIı]/g, 'i')
        .replace(/Ş/g, 'S')
        .replace(/ş/g, 's')
        .replace(/Ğ/g, 'G')
        .replace(/ğ/g, 'g')
        .replace(/Ü/g, 'U')
        .replace(/ü/g, 'u')
        .replace(/Ö/g, 'O')
        .replace(/ö/g, 'o')
        .replace(/Ç/g, 'C')
        .replace(/ç/g, 'c')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
}

function getValue<T = any>(row: any, key: string): T {
    return (row?.[key] ?? row?.[key.toUpperCase()]) as T
}

function isSpecial(title: string) {
    const value = norm(title)
    return value === 'muhasebe' || value === 'satinalma' || value === 'satin alma'
}

async function main() {
    await initializePool()

    const hospitals = await executeQuery(
        `SELECT id, title
         FROM folders
         WHERE parent_id IS NULL`
    )

    const hospitalRows = hospitals.map((row) => ({
        id: String(getValue(row, 'id')),
        title: String(getValue(row, 'title') || '').trim(),
        normTitle: norm(String(getValue(row, 'title') || ''))
    }))

    const targetHospitals = hospitalRows.filter((row) =>
        row.normTitle === norm('Çerkezköy')
        || row.normTitle === norm('Çorlu')
        || row.normTitle === norm('Genel')
        || row.normTitle === norm('Kapaklı')
    )

    const disallowedParents = targetHospitals
        .filter((row) => row.normTitle !== norm('Çerkezköy'))
        .map((row) => row.id)

    if (disallowedParents.length === 0) {
        console.log('No non-Çerkezköy hospital roots found.')
        return
    }

    const placeholders = disallowedParents.map((_, index) => `:p${index}`).join(', ')
    const params: Record<string, string> = {}
    disallowedParents.forEach((id, index) => {
        params[`p${index}`] = id
    })

    const childRows = await executeQuery(
        `SELECT id, title, parent_id
         FROM folders
         WHERE parent_id IN (${placeholders})`,
        params
    )

    const candidates = childRows.filter((row) => isSpecial(String(getValue(row, 'title') || '')))

    let deleted = 0
    let skipped = 0

    for (const row of candidates) {
        const id = String(getValue(row, 'id'))
        const title = String(getValue(row, 'title'))

        const listCountRows = await executeQuery(`SELECT COUNT(*) AS cnt FROM lists WHERE folder_id = :id`, { id })
        const childCountRows = await executeQuery(`SELECT COUNT(*) AS cnt FROM folders WHERE parent_id = :id`, { id })
        const listCount = Number(getValue(listCountRows[0], 'cnt') || 0)
        const childCount = Number(getValue(childCountRows[0], 'cnt') || 0)

        if (listCount > 0 || childCount > 0) {
            skipped++
            continue
        }

        await executeNonQuery(`DELETE FROM folder_members WHERE folder_id = :id`, { id })
        await executeNonQuery(`DELETE FROM folders WHERE id = :id`, { id })
        deleted++
        console.log(`- Removed '${title}' from non-Çerkezköy hospital`) 
    }

    console.log('--- Enforce Summary ---')
    console.log(`Candidates: ${candidates.length}`)
    console.log(`Deleted (empty): ${deleted}`)
    console.log(`Skipped (non-empty): ${skipped}`)
}

main()
    .catch((error) => {
        console.error('enforce_special_units_cerkezkoy_only failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
