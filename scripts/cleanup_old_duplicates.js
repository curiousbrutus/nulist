/**
 * Eski (import-öncesi) görevlerden Excel import'uyla ÖRTÜŞENLERİ bulur.
 *   node scripts/cleanup_old_duplicates.js            # DRY-RUN: örtüşme raporu (silme yok)
 *   node scripts/cleanup_old_duplicates.js --commit   # Adayları siler (yedek sonrası)
 *
 * Kurallar:
 *  - Yalnızca legacy_id'si XLS09_05-% OLMAYAN görevler aday (yani import edilenler değil)
 *  - "Zimbra Görevleri" klasörlerindeki kişisel görevlere DOKUNULMAZ
 *  - Bir eski görev, import edilmiş bir görevle yüksek başlık benzerliği (Jaccard ≥ 0.7) taşıyorsa duplike sayılır
 */
require('dotenv').config({ path: '.env.local' })
const oracledb = require('oracledb')
const COMMIT = process.argv.includes('--commit')

const fold = (s) => String(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/Ç/g, 'c').replace(/Ğ/g, 'g').replace(/Ö/g, 'o').replace(/Ş/g, 's').replace(/Ü/g, 'u')
    .toLowerCase().replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = (s) => new Set(fold(s).split(' ').filter(w => w.length > 2))
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let inter = 0; for (const x of a) if (b.has(x)) inter++; return inter / (a.size + b.size - inter) }

async function main() {
    oracledb.fetchAsString = [oracledb.CLOB, oracledb.NCLOB]
    const conn = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONN_STRING })
    const q = async (sql) => (await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows

    // imported titles (index by tokens)
    const imported = await q(`SELECT id, title FROM EBG_TASKS WHERE legacy_id LIKE 'XLS09_05-%'`)
    const importedTok = imported.map(t => ({ id: t.ID, title: t.TITLE, tok: tokens(t.TITLE) }))

    // old candidate tasks (not imported, not in Zimbra Görevleri folders)
    const old = await q(`
        SELECT t.id, t.title, f.title folder, par.title parent
        FROM EBG_TASKS t
        JOIN EBG_LISTS l ON l.id=t.list_id
        JOIN EBG_FOLDERS f ON f.id=l.folder_id
        LEFT JOIN EBG_FOLDERS par ON par.id=f.parent_id
        WHERE (t.legacy_id IS NULL OR t.legacy_id NOT LIKE 'XLS09_05-%')
          AND f.title <> 'Zimbra Görevleri'`)

    const dups = [], uniques = []
    for (const o of old) {
        const row = { id: o.ID, title: o.TITLE, folder: o.FOLDER, parent: o.PARENT }
        const ot = tokens(row.title)
        let best = 0, bestT = ''
        for (const it of importedTok) { const s = jaccard(ot, it.tok); if (s > best) { best = s; bestT = it.title } }
        if (best >= 0.7) dups.push({ ...row, score: best, match: bestT })
        else uniques.push({ ...row, score: best })
    }

    console.log(`\n=== ESKİ GÖREV ÖRTÜŞME RAPORU ===`)
    console.log(`Aday eski görev (Zimbra hariç): ${old.length}`)
    console.log(`  Duplike (Jaccard ≥ 0.7) → SİLİNEBİLİR: ${dups.length}`)
    console.log(`  Benzersiz (Excel'de yok) → KORUNUR:     ${uniques.length}`)

    console.log(`\n── Duplike adaylar (klasör ▸ başlık → eşleşen import) ──`)
    for (const d of dups.slice(0, 60)) console.log(`  [${d.score.toFixed(2)}] ${(d.parent || '')}/${d.folder} ▸ ${String(d.title).slice(0, 50)}`)
    if (dups.length > 60) console.log(`  … +${dups.length - 60} daha`)

    console.log(`\n── Benzersiz (korunacak) — klasör dağılımı ──`)
    const byFolder = {}
    for (const u of uniques) { const k = (u.parent || '') + '/' + u.folder; byFolder[k] = (byFolder[k] || 0) + 1 }
    Object.entries(byFolder).sort((a, b) => b[1] - a[1]).forEach(([k, c]) => console.log(`  ${String(c).padStart(3)} × ${k}`))

    // Güvenlik: yorum/eki olan duplike'leri KORU (gerçek çalışma kaybı olmasın)
    const withWork = new Set()
    for (const d of dups) {
        const c = (await q(`SELECT (SELECT COUNT(*) FROM EBG_COMMENTS WHERE task_id='${d.id}') cc, (SELECT COUNT(*) FROM EBG_TASK_ATTACHMENTS WHERE task_id='${d.id}') ac FROM dual`))[0]
        if ((c.CC || 0) > 0 || (c.AC || 0) > 0) withWork.add(d.id)
    }
    const safeDelete = dups.filter(d => !withWork.has(d.id))
    console.log(`\n── Silme güvenliği ──`)
    console.log(`  Duplike ama yorum/eki VAR → KORUNUR: ${withWork.size}`)
    console.log(`  Duplike + temiz → güvenli silme:     ${safeDelete.length}`)

    if (COMMIT && safeDelete.length) {
        console.log(`\n🔴 ${safeDelete.length} temiz duplike eski görev siliniyor…`)
        for (const d of safeDelete) await conn.execute(`DELETE FROM EBG_TASKS WHERE id=:id`, { id: d.id })
        await conn.commit()
        console.log(`✅ Silindi: ${safeDelete.length} görev (atamaları CASCADE ile gitti). ${withWork.size} görev yorum/ek nedeniyle korundu.`)
    } else {
        console.log(`\n🟢 DRY-RUN — silme yok. Silmek için: --commit`)
    }
    await conn.close()
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
