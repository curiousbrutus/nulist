// READ-ONLY: full backup to a file OUTSIDE the repo (PII) + folder-tree inspection.
require('dotenv').config({ path: '.env.local' })
const oracledb = require('oracledb')
const fs = require('fs')
const path = require('path')

async function main() {
    oracledb.fetchAsString = [oracledb.CLOB, oracledb.NCLOB]
    const conn = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONN_STRING })
    const q = async (sql) => (await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows

    const tables = ['EBG_PROFILES', 'EBG_FOLDERS', 'EBG_LISTS', 'EBG_TASKS', 'EBG_TASK_ASSIGNEES', 'EBG_DEPARTMENTS', 'EBG_FACILITIES', 'EBG_USER_DEPARTMENTS']
    const backup = { takenAt: new Date().toISOString(), tables: {} }
    for (const t of tables) {
        backup.tables[t] = await q(`SELECT * FROM ${t}`)
        console.log(`  yedeklendi ${t}: ${backup.tables[t].length} satır`)
    }

    const outDir = 'C:/Users/Administrator/Desktop/neolist_backups'
    fs.mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outPath = path.join(outDir, `prod_backup_${stamp}.json`)
    fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8')
    console.log(`\n✅ YEDEK: ${outPath}`)
    console.log(`   (repo DIŞINDA — PII içerdiği için commit edilmez)`)

    // ---- Folder tree: parents and their children ----
    console.log('\n=== PARENT KLASÖRLER (parent_id NULL olanlar) ve çocuk sayıları ===')
    const parents = await q(`
        SELECT f.id, f.title, p.full_name owner, p.role,
               (SELECT COUNT(*) FROM EBG_FOLDERS c WHERE c.parent_id = f.id) children,
               (SELECT COUNT(*) FROM EBG_LISTS l WHERE l.folder_id=f.id) lists
        FROM EBG_FOLDERS f LEFT JOIN EBG_PROFILES p ON p.id=f.user_id
        WHERE f.parent_id IS NULL
        ORDER BY children DESC, f.title`)
    for (const r of parents) console.log(`  "${r.TITLE}"  [child:${r.CHILDREN} list:${r.LISTS}] owner=${r.OWNER}/${r.ROLE}  id=${r.ID}`)

    console.log('\n=== "Çorlu" / "Çerkezköy" içeren klasör başlıkları ===')
    const named = await q(`SELECT title, parent_id FROM EBG_FOLDERS WHERE UPPER(title) LIKE '%CORLU%' OR UPPER(title) LIKE '%ÇORLU%' OR UPPER(title) LIKE '%CERKEZ%' OR UPPER(title) LIKE '%ÇERKEZ%'`)
    named.forEach(r => console.log(`  "${r.TITLE}"  parent=${r.PARENT_ID || '(kök)'}`))

    await conn.close()
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
