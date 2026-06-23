/**
 * Çorlu/Çerkezköy iş listesi importer.
 *
 *   node scripts/import_corlu_worklist.js            # DRY-RUN (yazma yok), pre-flight raporu
 *   node scripts/import_corlu_worklist.js --commit   # PROD'A YAZ (additive, transactional)
 *
 * Kararlar (kullanıcı onaylı):
 *  - Kaynak: yalnızca "ana liste" sayfası
 *  - Yapı:  mevcut facility parent ("Çorlu"/"Çerkezköy") → birim alt-klasörü (DB departman adı) → liste (TOPLANTI)
 *  - Eksik 7 birim → yeni departman (kullanılan facility altında)
 *  - Eksik 13 kişi → yeni profil (user_status='pending', Zimbra ile giriş)
 *  - branch = TOPLANTI ipucu (Çerkezköy/diğer=Çorlu); meeting_type = TOPLANTI
 *  - legacy_id = 'XLS09_05-<satır>'  → re-run idempotent + toplu geri alınabilir
 *  - Kişisel "Zimbra Görevleri" klasörlerine DOKUNULMAZ
 */
const XLSX = require('xlsx')
require('dotenv').config({ path: '.env.local' })
const oracledb = require('oracledb')

const COMMIT = process.argv.includes('--commit')
const XLSX_PATH = 'C:/Users/Administrator/Desktop/optimed_is_listesi_09_05.xlsx'
const BATCH = 'XLS09_05'

// ---------- helpers ----------
const fold = (s) => String(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/Ç/g, 'c').replace(/Ğ/g, 'g')
    .replace(/Ö/g, 'o').replace(/Ş/g, 's').replace(/Ü/g, 'u').replace(/Â/g, 'a')
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/â/g, 'a')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim()

const emailSlug = (name) => fold(name).replace(/[^a-z0-9]/g, '')
const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const NAME_ALIASES = {
    'arzu ceren ciftci': 'Arzu Ceren Tuna', 'filiz hanim': 'Filiz Albayrak',
    'cagatay bey': 'Çağatay Şen', 'buse hanim': 'Buse Rahvan',
}
const NON_PERSON = new Set(['tum yoneticiler', 'teknik servis', 'biyomedikal',
    'kalite yonetimi direktorlugu', 'tum subeler', 'hemsirelik'])

const BIRIM_TO_DEPT = {
    'hemsirelik hizmetleri': 'Hemşirelik Hizmetleri', 'teknik hizmetler': 'Teknik Hizmetler',
    'kalite direktorlugu': 'Kalite', 'bilgi islem': 'Bilgi Teknolojileri',
    'hasta hizmetleri': 'Hasta Hizmetleri', 'insan kaynaklari': 'İnsan Kaynakları ve Eğitim',
    'muhasebe': 'Genel Muhasebe ve Finans', 'satin alma': 'Satın Alma',
    'is sagligi ve guvenligi': 'İSG', 'depo / lojistik': 'Stok Yönetimi',
    'anlasmali kurumlar': 'Medikal Muhasebe ve Anlaşmalı Kurumlar', 'kurumsal ve basin': 'Basın Yayın',
    // departman karşılığı olmayanlar → YENİ departman olarak oluşturulacak (değer = oluşturulacak ad)
    'tibbi direktor': 'Tıbbi Direktörlük', 'genel mudurluk (gmy)': 'Genel Müdürlük',
    'destek hizmetleri': 'Destek Hizmetleri', 'egitim ve enfeksiyon': 'Eğitim ve Enfeksiyon',
    'eczane hizmetleri': 'Eczane Hizmetleri', 'otelcilik hizmetleri': 'Otelcilik Hizmetleri',
    'tum yoneticiler': 'Genel Müdürlük',
}
// Hangi birimler için YENİ departman yaratılacak (DB'de yoktu)
const NEW_DEPTS = new Set(['Tıbbi Direktörlük', 'Genel Müdürlük', 'Destek Hizmetleri', 'Eğitim ve Enfeksiyon', 'Eczane Hizmetleri', 'Otelcilik Hizmetleri'])

function parseDate(raw) {
    if (raw instanceof Date && !isNaN(raw)) return raw
    const s = String(raw || '').trim(); if (!s) return null
    let m
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) { let [, mo, d, y] = m; return mk(y, mo, d) }
    if ((m = s.match(/^(\d{1,2})[.,](\d{1,2})[.,](\d{2,4})$/))) { let [, d, mo, y] = m; return mk(y, mo, d) }
    return null
}
function mk(y, mo, d) { y = y.length === 2 ? '20' + y : y; const dt = new Date(Number(y), Number(mo) - 1, Number(d)); return (!isNaN(dt) && dt.getFullYear() >= 2020 && dt.getFullYear() <= 2030) ? dt : null }

function normStatus(raw) {
    const f = fold(raw)
    if (f.includes('tamam') || f.includes('bitti')) return { status: 'completed', is_completed: 1 }
    if (f.includes('iptal')) return { status: 'cancelled', is_completed: 0 }
    if (f.includes('surekli') || f.includes('gerektik')) return { status: 'ongoing', is_completed: 0 }
    if (f.includes('devam')) return { status: 'in_progress', is_completed: 0 }
    return { status: 'pending', is_completed: 0 }
}
const branchOf = (t) => fold(t).includes('cerkezkoy') ? 'Çerkezköy' : 'Çorlu'

async function main() {
    console.log(`\n=== İŞ LİSTESİ IMPORT — ${COMMIT ? '🔴 COMMIT (PROD YAZMA)' : '🟢 DRY-RUN (yazma yok)'} ===\n`)

    // ---- read Excel ----
    const wb = XLSX.readFile(XLSX_PATH, { cellDates: true })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['ana liste'], { header: 1, raw: false, defval: '' })
    const H = rows[0].map(h => String(h).trim())
    const col = (n) => H.findIndex(h => h.toUpperCase().includes(n.toUpperCase()))
    const ci = { sira: col('SIRA'), atanma: col('ATANDIĞI TARİH'), toplanti: col('BELİRLENDİĞİ TOPLANTI'), is: col('YAPILACAK İŞ'), p1: col('BİRİNCİL SORUMLU'), p2: col('İKİNCİL SORUMLU'), termin: col('TERMİN'), aciklama: H.indexOf('AÇIKLAMA'), bitis: col('BİTİŞ'), durum: col('DURUMU'), not: H.indexOf('NOT'), birim: H.indexOf('BİRİM') }

    // ---- DB connect ----
    oracledb.fetchAsString = [oracledb.CLOB, oracledb.NCLOB]
    const conn = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD, connectString: process.env.ORACLE_CONN_STRING })
    const sel = async (sql, b = {}) => (await conn.execute(sql, b, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows

    const profs = await sel(`SELECT id, full_name, email FROM EBG_PROFILES`)
    const byFold = new Map(profs.map(p => [fold(p.FULL_NAME), p]))
    const existingEmails = new Set(profs.map(p => fold(p.EMAIL)))
    const facilities = await sel(`SELECT id, name FROM EBG_FACILITIES`)
    const facByName = new Map(facilities.map(f => [fold(f.NAME), f.ID]))
    const depts = await sel(`SELECT id, name, facility_id FROM EBG_DEPARTMENTS`)
    const deptKey = (name, facId) => fold(name) + '|' + facId
    const deptMap = new Map(depts.map(d => [deptKey(d.NAME, d.FACILITY_ID), d.ID]))
    const parentFolders = await sel(`SELECT id, title FROM EBG_FOLDERS WHERE parent_id IS NULL AND title IN ('Çorlu','Çerkezköy')`)
    const parentByBranch = new Map(parentFolders.map(f => [f.TITLE, f.ID]))
    const childFolders = await sel(`SELECT id, title, parent_id FROM EBG_FOLDERS WHERE parent_id IS NOT NULL`)
    const folderKey = (title, parentId) => fold(title) + '|' + parentId
    const folderMap = new Map(childFolders.map(f => [folderKey(f.TITLE, f.PARENT_ID), f.ID]))
    const existingLegacy = new Set((await sel(`SELECT legacy_id FROM EBG_TASKS WHERE legacy_id IS NOT NULL`)).map(r => r.LEGACY_ID))
    const adminId = (profs.find(p => fold(p.FULL_NAME) === 'elcin suleymanoglu') || profs.find(p => fold(p.EMAIL).startsWith('elcinsuleymanoglu')) || profs[0]).ID

    const matchName = (n) => {
        const f = fold(n)
        if (NON_PERSON.has(f)) return { kind: 'group' }
        if (NAME_ALIASES[f]) { const p = byFold.get(fold(NAME_ALIASES[f])); if (p) return { kind: 'matched', id: p.ID } }
        let p = byFold.get(f)
        if (!p) for (const [pf, c] of byFold) { const a = f.split(' '), b = pf.split(' '); if (a[0] === b[0] && a[a.length - 1] === b[b.length - 1]) { p = c; break } }
        return p ? { kind: 'matched', id: p.ID } : { kind: 'missing', name: n }
    }

    // ---- PLAN (in-memory) ----
    const plan = {
        newDepts: new Map(),     // key name|fac -> {name, facId}
        newAccounts: new Map(),  // foldedName -> {name, email}
        newFolders: new Map(),   // key title|parent -> {title, parent}
        newLists: new Map(),     // key title|folderKey -> {title, folderRef}
        taskRows: [], assigneeRows: [],
        skipExisting: 0, missingByName: new Map(),
    }
    const data = rows.slice(1)
    for (let i = 0; i < data.length; i++) {
        const r = data[i]
        const isText = String(r[ci.is] ?? '').trim()
        if (!isText) continue
        const legacy = `${BATCH}-${i + 1}`
        if (existingLegacy.has(legacy)) { plan.skipExisting++; continue }

        const toplanti = String(r[ci.toplanti] ?? '').trim() || 'Genel'
        const birimRaw = String(r[ci.birim] ?? '').trim() || 'Genel Müdürlük'
        const branch = branchOf(toplanti)
        const facId = facByName.get(fold(branch))
        const deptName = BIRIM_TO_DEPT[fold(birimRaw)] || birimRaw
        const parentId = parentByBranch.get(branch)

        // department (create if missing & it's one of our NEW_DEPTS or simply absent)
        let deptId = deptMap.get(deptKey(deptName, facId))
        if (!deptId) { plan.newDepts.set(deptKey(deptName, facId), { name: deptName, facId }) }

        // folder (under facility parent, titled as deptName)
        const fKey = folderKey(deptName, parentId)
        const folderExists = folderMap.has(fKey)
        if (!folderExists) plan.newFolders.set(fKey, { title: deptName, parent: parentId })

        // list (under folder, titled as TOPLANTI)
        const lKey = fold(toplanti) + '|' + fKey
        if (!plan.newLists.has(lKey)) plan.newLists.set(lKey, { title: toplanti, fKey })

        // status / dates / notes
        const st = normStatus(r[ci.durum])
        const meetingDate = parseDate(r[ci.atanma])
        const dueDate = parseDate(r[ci.termin])
        const completedDate = st.is_completed ? parseDate(r[ci.bitis]) : null
        const aciklama = String(r[ci.aciklama] ?? '').trim()
        const not = String(r[ci.not] ?? '').trim()
        const notes = [aciklama, not && `Not: ${not}`].filter(Boolean).join('\n\n') || null

        // assignees
        const assignees = []
        for (const c of [ci.p1, ci.p2]) {
            const raw = String(r[c] ?? '').trim(); if (!raw) continue
            const role = c === ci.p1 ? 'primary' : 'secondary'
            for (const nm of raw.split(/[,&\n]|\bve\b/).map(x => x.trim()).filter(Boolean)) {
                const m = matchName(nm)
                if (m.kind === 'matched') assignees.push({ id: m.id, role })
                else if (m.kind === 'missing') {
                    const fn = fold(nm)
                    if (!plan.newAccounts.has(fn)) {
                        let email = emailSlug(nm) + '@optimed.com.tr', n = 1
                        while (existingEmails.has(fold(email)) || [...plan.newAccounts.values()].some(a => fold(a.email) === fold(email))) email = emailSlug(nm) + (++n) + '@optimed.com.tr'
                        plan.newAccounts.set(fn, { name: nm, email })
                    }
                    plan.missingByName.set(nm, (plan.missingByName.get(nm) || 0) + 1)
                    assignees.push({ pendingName: fn, role })
                }
            }
        }

        plan.taskRows.push({ legacy, lKey, title: isText.slice(0, 250), notes, meetingDate, dueDate, completedDate, branch, meetingType: toplanti, ...st, assignees })
    }
    const wouldImport = plan.taskRows.length

    // ---- DRY-RUN REPORT ----
    const P = (l, v) => console.log(`  ${String(l).padEnd(36)} ${v}`)
    console.log('── PRE-FLIGHT (yapılacaklar) ──')
    P('İçeri alınacak görev', wouldImport)
    P('Zaten var (legacy_id) → atlanır', plan.skipExisting)
    P('Yeni DEPARTMAN', plan.newDepts.size); [...plan.newDepts.values()].forEach(d => console.log(`     + ${d.name}  (${facilities.find(f => f.ID === d.facId)?.NAME})`))
    P('Yeni HESAP (status=pending)', plan.newAccounts.size); [...plan.newAccounts.values()].forEach(a => console.log(`     + ${a.name.padEnd(22)} → ${a.email}`))
    P('Yeni KLASÖR (birim)', plan.newFolders.size)
    P('Yeni LİSTE (toplantı)', plan.newLists.size)
    let totAssign = 0, pendAssign = 0
    for (const t of plan.taskRows) for (const a of t.assignees) { totAssign++; if (a.pendingName) pendAssign++ }
    P('Toplam atama', `${totAssign}  (bekleyen hesaba: ${pendAssign})`)

    if (!COMMIT) {
        await conn.close()
        console.log('\n🟢 DRY-RUN bitti — DB\'ye hiçbir şey yazılmadı. Yazmak için: --commit')
        return
    }

    // ================= COMMIT =================
    console.log('\n🔴 COMMIT başlıyor (tek transaction)…')
    const exec = (sql, b) => conn.execute(sql, b)
    try {
        // 1) departments
        for (const [k, d] of plan.newDepts) { const id = uid('dept'); await exec(`INSERT INTO EBG_DEPARTMENTS (id, facility_id, name, is_active) VALUES (:id,:fac,:name,1)`, { id, fac: d.facId, name: d.name }); deptMap.set(k, id) }
        // 2) accounts
        const accountId = new Map()
        for (const [fn, a] of plan.newAccounts) { const id = uid('usr'); await exec(`INSERT INTO EBG_PROFILES (id, email, full_name, role, user_status) VALUES (:id,:em,:fn,'user','pending')`, { id, em: a.email, fn: a.name }); accountId.set(fn, id) }
        // 3) folders
        for (const [k, f] of plan.newFolders) { const id = uid('folder'); await exec(`INSERT INTO EBG_FOLDERS (id, user_id, title, parent_id) VALUES (:id,:owner,:t,:p)`, { id, owner: adminId, t: f.title, p: f.parent }); folderMap.set(k, id) }
        // 4) lists
        const listId = new Map()
        for (const [lk, l] of plan.newLists) { const fId = folderMap.get(l.fKey); const id = uid('list'); await exec(`INSERT INTO EBG_LISTS (id, folder_id, title, type) VALUES (:id,:f,:t,'list')`, { id, f: fId, t: l.title }); listId.set(lk, id) }
        // 5) tasks + assignees
        let nTask = 0, nAssign = 0
        for (const t of plan.taskRows) {
            const tId = uid('task')
            await exec(`INSERT INTO EBG_TASKS (id, list_id, title, notes, due_date, meeting_date, completed_at, priority, status, is_completed, branch, meeting_type, legacy_id, created_by)
                        VALUES (:id,:lid,:title,:notes,:due,:mdate,:cdate,'Orta',:status,:done,:branch,:mtype,:legacy,:cb)`,
                { id: tId, lid: listId.get(t.lKey), title: t.title, notes: t.notes, due: t.dueDate, mdate: t.meetingDate, cdate: t.completedDate, status: t.status, done: t.is_completed, branch: t.branch, mtype: t.meetingType, legacy: t.legacy, cb: adminId })
            nTask++
            const seen = new Set()
            for (const a of t.assignees) {
                const auid = a.id || accountId.get(a.pendingName)
                if (!auid || seen.has(auid)) continue
                seen.add(auid)
                await exec(`INSERT INTO EBG_TASK_ASSIGNEES (task_id, user_id, responsibility_role) VALUES (:t,:u,:r)`, { t: tId, u: auid, r: a.role })
                nAssign++
            }
        }
        await conn.commit()
        console.log(`✅ COMMIT tamam: ${nTask} görev, ${nAssign} atama, ${plan.newDepts.size} departman, ${plan.newAccounts.size} hesap, ${plan.newFolders.size} klasör, ${plan.newLists.size} liste.`)
        console.log(`   Geri alma: DELETE EBG_TASKS WHERE legacy_id LIKE '${BATCH}-%'`)
    } catch (e) {
        await conn.rollback()
        console.error('❌ HATA → rollback yapıldı. Hiçbir değişiklik kalmadı.\n', e.message)
        process.exitCode = 1
    } finally {
        await conn.close()
    }
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
