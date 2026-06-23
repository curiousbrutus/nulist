/**
 * TÜM görevlerde status'u kanonik değere normalize eder ve is_completed'i status'tan TÜRETİR.
 *   node scripts/fix_status_normalize.js            # DRY-RUN (değişecekleri raporlar)
 *   node scripts/fix_status_normalize.js --commit   # uygular
 *
 * Kanonik: pending | in_progress | ongoing | completed | cancelled
 * is_completed = (completed veya cancelled) ? 1 : 0   (kapalı = listeden düşer)
 */
require('dotenv').config({ path: '.env.local' })
const oracledb = require('oracledb')
const COMMIT = process.argv.includes('--commit')

const fold = (s) => String(s || '').replace(/İ/g,'i').replace(/I/g,'i').replace(/Ç/g,'c').replace(/Ş/g,'s').toLowerCase()
    .replace(/ç/g,'c').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ö/g,'o').replace(/ü/g,'u').normalize('NFKD').replace(/[̀-ͯ]/g,'').trim()

function canon(status) {
    const f = fold(status)
    if (!f || f === 'null') return { status: 'pending', done: 0 }
    if (f.includes('tamam') || f.includes('bitti') || f === 'completed' || f === 'done') return { status: 'completed', done: 1 }
    if (f.includes('iptal') || f === 'cancelled') return { status: 'cancelled', done: 1 }
    if (f.includes('surekli') || f.includes('gerektik') || f === 'ongoing') return { status: 'ongoing', done: 0 }
    if (f.includes('devam') || f === 'in_progress' || f.includes('progress')) return { status: 'in_progress', done: 0 }
    if (f === 'todo' || f === 'pending' || f === 'waiting' || f === 'beklemede') return { status: 'pending', done: 0 }
    return { status: 'pending', done: 0 }
}

async function main() {
    const conn = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONN_STRING })
    const q = async (s, b = {}) => (await conn.execute(s, b, { outFormat: oracledb.OUT_FORMAT_OBJECT }))
    const rows = (await q(`SELECT id, status, is_completed FROM EBG_TASKS`)).rows

    let changes = [], statusChange = 0, doneChange = 0
    for (const r of rows) {
        const cur = { status: r.STATUS, done: Number(r.IS_COMPLETED) }
        const want = canon(r.STATUS)
        if (cur.status !== want.status || cur.done !== want.done) {
            changes.push({ id: r.ID, from: `${r.STATUS}/${cur.done}`, to: `${want.status}/${want.done}`, ...want })
            if (cur.status !== want.status) statusChange++
            if (cur.done !== want.done) doneChange++
        }
    }
    console.log(`Toplam görev: ${rows.length} · değişecek: ${changes.length} (status:${statusChange}, is_completed:${doneChange})`)
    // özet: hangi geçişler
    const trans = {}
    for (const c of changes) trans[`${c.from} → ${c.to}`] = (trans[`${c.from} → ${c.to}`] || 0) + 1
    console.log('\n── Geçişler (eski status/done → yeni) ──')
    Object.entries(trans).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${String(v).padStart(4)} × ${k}`))

    if (COMMIT && changes.length) {
        for (const c of changes) await q(`UPDATE EBG_TASKS SET status=:s, is_completed=:d WHERE id=:id`, { s: c.status, d: c.done, id: c.id })
        await conn.commit()
        console.log(`\n✅ ${changes.length} görev güncellendi.`)
    } else {
        console.log(`\n🟢 DRY-RUN — yazma yok. Uygulamak için: --commit`)
    }
    await conn.close()
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
