import dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'
import { initializePool, closePool, executeQuery, executeNonQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const EXCLUDED_TOP_LEVEL = new Set(['zimbra görevleri'])
const TARGET_HOSPITALS = new Set([
    norm('Çerkezköy'),
    norm('Çorlu'),
    norm('Genel'),
    norm('Merkez'),
    norm('Kapaklı')
])
const MERKEZ_UNITS = [
    'Satınalma',
    'Genel Müdürlük',
    'Muhasebe',
    'İş Geliştirme',
    'Bilgi İşlem',
    'Kalite',
    'Hasta Hizmetleri',
    'İnsan Kaynakları',
    'Tıbbi Direktörlük'
]
const EXPECTED_COMMON_UNITS = [
    'Bilgi İşlem',
    'Teknik Hizmetler',
    'Uluslararası Hasta Hizmetleri',
    'İdari Tıbbi Sekreterlik',
    'Resmi Kurum Süreçleri ve Denetimleri',
    'Hemşirelik Hizmetleri Müdürleri',
    'Mali İşler ve Finans',
    'Genel Muhasebe ve Finans',
    'Medikal Muhasebe ve Anlaşmalı Kurumlar',
    'Stok Yönetimi',
    'Kurumsal Pazarlama',
    'Çağrı Merkezi',
    'Basın Yayın',
    'Hasta Hizmetleri Müdürleri',
    'İnsan Kaynakları ve Eğitim',
    'İK',
    'Kalite',
    'İSG',
    'Arşiv',
    'İş Geliştirme',
    'Yönetim Asistanlığı'
]
const SPECIAL_ONLY_CERKEZKOY = [
    'Muhasebe',
    'Satınalma'
]

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

function isSpecialOnly(title: string) {
    const value = norm(title)
    return value === norm('Muhasebe') || value === norm('Satınalma') || value === norm('Satin Alma')
}

function getValue<T = any>(row: any, key: string): T {
    return (row?.[key] ?? row?.[key.toUpperCase()]) as T
}

async function main() {
    await initializePool()

    const hospitals = await executeQuery(
        `SELECT id, title, user_id
         FROM folders
         WHERE parent_id IS NULL
         ORDER BY created_at ASC`
    )

    const hospitalRows = hospitals
        .map((row) => ({
            id: String(getValue(row, 'id')),
            title: String(getValue(row, 'title') || '').trim(),
            userId: String(getValue(row, 'user_id') || '')
        }))
        .filter((row) => row.title)
        .filter((row) => {
            const normalized = norm(row.title)
            if (EXCLUDED_TOP_LEVEL.has(normalized)) return false
            if (normalized.includes('zimbra gorevleri')) return false
            return TARGET_HOSPITALS.has(normalized)
        })

    if (hospitalRows.length === 0) {
        console.log('No hospital top-level folders found.')
        return
    }

    const parentIds = hospitalRows.map((row) => row.id)
    const placeholders = parentIds.map((_, index) => `:p${index}`).join(', ')
    const parentParams: Record<string, string> = {}
    parentIds.forEach((id, index) => {
        parentParams[`p${index}`] = id
    })

    const childUnits = await executeQuery(
        `SELECT id, title, parent_id, user_id
         FROM folders
         WHERE parent_id IN (${placeholders})
         ORDER BY created_at ASC`,
        parentParams
    )

    const unitsByHospital = new Map<string, Array<{ id: string; title: string; norm: string }>>()
    for (const hospital of hospitalRows) {
        unitsByHospital.set(hospital.id, [])
    }

    for (const unit of childUnits) {
        const parentId = String(getValue(unit, 'parent_id') || '')
        if (!unitsByHospital.has(parentId)) continue

        const title = String(getValue(unit, 'title') || '').trim()
        if (!title) continue

        unitsByHospital.get(parentId)!.push({
            id: String(getValue(unit, 'id')),
            title,
            norm: norm(title)
        })
    }

    const canonicalByNorm = new Map<string, string>()
    for (const unit of MERKEZ_UNITS) {
        canonicalByNorm.set(norm(unit), unit)
    }
    for (const unit of EXPECTED_COMMON_UNITS) {
        canonicalByNorm.set(norm(unit), unit)
    }
    for (const unit of SPECIAL_ONLY_CERKEZKOY) {
        canonicalByNorm.set(norm(unit), unit)
    }

    let createdCount = 0
    let removedSpecialCount = 0
    let skippedSpecialRemoval = 0
    let renamedToMerkez = 0
    let renamedUnitTitles = 0
    let removedDisallowedMerkezUnits = 0
    let skippedDisallowedMerkezUnits = 0

    const expectedCommonNorms = new Set(EXPECTED_COMMON_UNITS.map((item) => norm(item)))
    const expectedSpecialNorms = new Set(SPECIAL_ONLY_CERKEZKOY.map((item) => norm(item)))
    const merkezNorm = norm('Merkez')
    const merkezAllowedNorms = new Set(MERKEZ_UNITS.map((item) => norm(item)))

    for (const hospital of hospitalRows) {
        let hospitalNorm = norm(hospital.title)
        let hospitalTitle = hospital.title

        if (hospitalNorm === norm('Genel')) {
            await executeNonQuery(
                `UPDATE folders SET title = :title WHERE id = :id`,
                { id: hospital.id, title: 'Merkez' }
            )
            hospitalNorm = merkezNorm
            hospitalTitle = 'Merkez'
            renamedToMerkez++
            console.log(`~ Renamed top-level '${hospital.title}' to 'Merkez'`)
        }

        const existing = unitsByHospital.get(hospital.id) || []
        const existingNorm = new Set(existing.map((item) => item.norm))

        const requiredNorms = new Set<string>()

        if (hospitalNorm === merkezNorm) {
            for (const unitNorm of merkezAllowedNorms) {
                requiredNorms.add(unitNorm)
            }
        } else {
            for (const unitNorm of expectedCommonNorms) {
                requiredNorms.add(unitNorm)
            }
        }

        if (hospitalNorm === norm('Çerkezköy')) {
            for (const special of SPECIAL_ONLY_CERKEZKOY) {
                requiredNorms.add(norm(special))
            }
        } else if (hospitalNorm !== merkezNorm) {
            for (const unit of existing) {
                if (!expectedSpecialNorms.has(unit.norm)) continue

                const listCountRows = await executeQuery(
                    `SELECT COUNT(*) AS cnt FROM lists WHERE folder_id = :id`,
                    { id: unit.id }
                )
                const childCountRows = await executeQuery(
                    `SELECT COUNT(*) AS cnt FROM folders WHERE parent_id = :id`,
                    { id: unit.id }
                )

                const listCount = Number(getValue(listCountRows[0], 'cnt') || 0)
                const childCount = Number(getValue(childCountRows[0], 'cnt') || 0)

                if (listCount > 0 || childCount > 0) {
                    skippedSpecialRemoval++
                    continue
                }

                await executeNonQuery(`DELETE FROM folder_members WHERE folder_id = :id`, { id: unit.id })
                await executeNonQuery(`DELETE FROM folders WHERE id = :id`, { id: unit.id })
                removedSpecialCount++
                existingNorm.delete(unit.norm)
                console.log(`- Removed special unit '${unit.title}' from '${hospitalTitle}' (non-Çerkezköy)`)
            }
        }

        if (hospitalNorm === merkezNorm) {
            for (const unit of existing) {
                if (requiredNorms.has(unit.norm)) continue

                if (unit.norm === norm('Genel')) {
                    const target = existing.find((candidate) => candidate.norm === norm('Genel Müdürlük'))
                    if (target && target.id !== unit.id) {
                        await executeNonQuery(
                            `UPDATE lists SET folder_id = :target_id WHERE folder_id = :source_id`,
                            { target_id: target.id, source_id: unit.id }
                        )
                        await executeNonQuery(
                            `UPDATE folders SET parent_id = :target_id WHERE parent_id = :source_id`,
                            { target_id: target.id, source_id: unit.id }
                        )
                        await executeNonQuery(`DELETE FROM folder_members WHERE folder_id = :id`, { id: unit.id })
                        await executeNonQuery(`DELETE FROM folders WHERE id = :id`, { id: unit.id })
                        removedDisallowedMerkezUnits++
                        existingNorm.delete(unit.norm)
                        console.log("~ Merged disallowed Merkez unit 'Genel' into 'Genel Müdürlük'")
                        continue
                    }
                }

                const listCountRows = await executeQuery(
                    `SELECT COUNT(*) AS cnt FROM lists WHERE folder_id = :id`,
                    { id: unit.id }
                )
                const childCountRows = await executeQuery(
                    `SELECT COUNT(*) AS cnt FROM folders WHERE parent_id = :id`,
                    { id: unit.id }
                )

                const listCount = Number(getValue(listCountRows[0], 'cnt') || 0)
                const childCount = Number(getValue(childCountRows[0], 'cnt') || 0)

                if (listCount > 0 || childCount > 0) {
                    skippedDisallowedMerkezUnits++
                    console.log(`! Skipped disallowed Merkez unit '${unit.title}' (non-empty)`)
                    continue
                }

                await executeNonQuery(`DELETE FROM folder_members WHERE folder_id = :id`, { id: unit.id })
                await executeNonQuery(`DELETE FROM folders WHERE id = :id`, { id: unit.id })
                removedDisallowedMerkezUnits++
                existingNorm.delete(unit.norm)
                console.log(`- Removed disallowed Merkez unit '${unit.title}'`) 
            }
        }

        for (const unit of existing) {
            if (!requiredNorms.has(unit.norm)) continue
            const canonicalTitle = canonicalByNorm.get(unit.norm)
            if (!canonicalTitle || unit.title === canonicalTitle) continue

            await executeNonQuery(
                `UPDATE folders SET title = :title WHERE id = :id`,
                { id: unit.id, title: canonicalTitle }
            )
            renamedUnitTitles++
            console.log(`~ Renamed unit '${unit.title}' to '${canonicalTitle}' under '${hospitalTitle}'`)
        }

        for (const requiredNorm of requiredNorms) {
            if (existingNorm.has(requiredNorm)) continue

            const title = canonicalByNorm.get(requiredNorm) || requiredNorm
            await executeNonQuery(
                `INSERT INTO folders (id, title, user_id, parent_id)
                 VALUES (:id, :title, :user_id, :parent_id)`,
                {
                    id: crypto.randomUUID(),
                    title,
                    user_id: hospital.userId,
                    parent_id: hospital.id
                }
            )

            createdCount++
            console.log(`+ Added unit '${title}' under '${hospitalTitle}'`)
        }
    }

    const summary = await executeQuery(
        `SELECT p.title AS hospital, COUNT(c.id) AS unit_count
         FROM folders p
         LEFT JOIN folders c ON c.parent_id = p.id
         WHERE p.parent_id IS NULL
           AND UPPER(TRIM(p.title)) <> UPPER(TRIM('Zimbra Görevleri'))
         GROUP BY p.title
         ORDER BY p.title ASC`
    )

    console.log('--- Sync Summary ---')
    console.log(`Hospitals: ${hospitalRows.length}`)
    console.log(`Top-level renamed to Merkez: ${renamedToMerkez}`)
    console.log(`Unit titles normalized: ${renamedUnitTitles}`)
    console.log(`Units created: ${createdCount}`)
    console.log(`Special units removed outside Çerkezköy (empty only): ${removedSpecialCount}`)
    console.log(`Special removals skipped (non-empty): ${skippedSpecialRemoval}`)
    console.log(`Merkez disallowed units removed (empty only): ${removedDisallowedMerkezUnits}`)
    console.log(`Merkez disallowed removals skipped (non-empty): ${skippedDisallowedMerkezUnits}`)
    console.table(summary)
    console.log("Template source: Optimed organization chart. Merkez has dedicated unit set.")
}

main()
    .catch((error) => {
        console.error('ensure_hospital_units failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
