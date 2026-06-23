// Grant superadmin to eyyubguven + fix is_completed for imported completed/cancelled tasks.
require('dotenv').config({ path: '.env.local' })
const oracledb = require('oracledb')
async function main() {
    const conn = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONN_STRING })
    const q = async (sql, b = {}) => (await conn.execute(sql, b, { outFormat: oracledb.OUT_FORMAT_OBJECT }))

    // 1) grant superadmin
    const g = await q(`UPDATE EBG_PROFILES SET role='superadmin' WHERE email='eyyubguven@optimed.com.tr'`)
    console.log(`eyyubguven → superadmin: ${g.rowsAffected} satır`)

    // 2) before
    const before = (await q(`SELECT COUNT(*) c FROM EBG_TASKS WHERE legacy_id LIKE 'XLS09_05-%' AND is_completed=1`)).rows[0].C
    // fix completed + cancelled (closed) → is_completed=1
    const u1 = await q(`UPDATE EBG_TASKS SET is_completed=1 WHERE legacy_id LIKE 'XLS09_05-%' AND status IN ('completed','cancelled') AND is_completed=0`)
    // set completed_at for completed without a date (use SYSTIMESTAMP fallback so export shows a date)
    const u2 = await q(`UPDATE EBG_TASKS SET completed_at=NVL(completed_at, SYSTIMESTAMP) WHERE legacy_id LIKE 'XLS09_05-%' AND status='completed'`)
    await conn.commit()

    console.log(`is_completed=1 yapıldı (completed+cancelled): ${u1.rowsAffected} satır`)
    console.log(`completed_at dolduruldu: ${u2.rowsAffected} satır`)

    // verify
    const v = (await q(`SELECT status, is_completed, COUNT(*) c FROM EBG_TASKS WHERE legacy_id LIKE 'XLS09_05-%' GROUP BY status, is_completed ORDER BY status`)).rows
    console.log('\n=== Import batch status × is_completed ===')
    v.forEach(r => console.log(`  ${String(r.STATUS).padEnd(12)} is_completed=${r.IS_COMPLETED}  → ${r.C}`))
    const role = (await q(`SELECT role, user_status FROM EBG_PROFILES WHERE email='eyyubguven@optimed.com.tr'`)).rows[0]
    console.log(`\neyyubguven role=${role.ROLE}`)
    await conn.close()
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
