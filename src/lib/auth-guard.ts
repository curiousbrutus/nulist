/**
 * TEK YETKİ KAYNAĞI (single source of truth).
 *
 * Prod'da Oracle VPD politikaları KAPALI (user_policies boş). Bu yüzden görev/klasör
 * görünürlüğü ve erişim kontrolü TAMAMEN burada tanımlanır. Tüm route'lar bu modülü
 * kullanmalı — kendi inline yetki SQL'lerini YAZMAMALI.
 *
 * UYARI: migrations/021_*.sql VPD politikalarını yeniden ekler. Prod'da ÇALIŞTIRMAYIN;
 * çalıştırılırsa DB satır-seviyesi filtreyle bu katmanı çakıştırır.
 */
import { executeQuery } from '@/lib/oracle'

export interface AccessResult {
    allowed: boolean
    reason?: string
    role?: string
}

const PRIVILEGED_ROLES = ['admin', 'superadmin']

/**
 * Görev görünürlüğü için KANONİK SQL predicate'i.
 * Çağıran sorguda görev tablosu `t` olarak aliaslanmalı (örn. FROM tasks t).
 * Sadece `t`'ye ve kendi alt-sorgularına dayanır; dış join gerektirmez.
 * Bind: :vis_uid
 */
export const TASK_VISIBILITY_SQL = `(
    t.created_by = :vis_uid
    OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = :vis_uid)
    OR EXISTS (
        SELECT 1 FROM lists l JOIN folders f ON f.id = l.folder_id
        WHERE l.id = t.list_id AND f.user_id = :vis_uid
    )
    OR EXISTS (
        SELECT 1 FROM lists l
        JOIN folder_members fm ON fm.user_id = :vis_uid
        WHERE l.id = t.list_id
          AND fm.folder_id IN (
              SELECT af.id FROM folders af
              START WITH af.id = l.folder_id
              CONNECT BY PRIOR af.parent_id = af.id
          )
    )
    OR EXISTS (
        SELECT 1 FROM task_assignees ta
        JOIN profile_managers pm ON ta.user_id = pm.profile_id
        WHERE ta.task_id = t.id AND pm.manager_id = :vis_uid
    )
    OR EXISTS (
        SELECT 1 FROM lists l
        JOIN folders f ON f.id = l.folder_id
        LEFT JOIN folders pf ON pf.id = f.parent_id
        JOIN user_departments ud ON ud.user_id = :vis_uid
        JOIN departments d ON d.id = ud.department_id
        JOIN facilities fac ON fac.id = d.facility_id
        WHERE l.id = t.list_id
          AND (
              UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
              OR UPPER(TRIM(NVL(pf.title, ''))) = UPPER(TRIM(d.name))
          )
          AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
    )
)`

/**
 * Rol + kullanıcıya göre görev görünürlük filtresini üretir.
 *   admin/superadmin → tümü ('1=1')
 *   secretary        → kendi şubesi (t.branch = :vis_branch)
 *   diğer            → TASK_VISIBILITY_SQL
 * Çağıran sorguda görev tablosu `t` olmalı.
 */
export function buildTaskVisibility(role: string, userId: string, branch?: string | null):
    { clause: string; params: Record<string, any> } {
    if (PRIVILEGED_ROLES.includes(role)) return { clause: '1=1', params: {} }
    if (role === 'secretary' && branch) {
        return { clause: 't.branch = :vis_branch', params: { vis_branch: branch } }
    }
    return { clause: TASK_VISIBILITY_SQL, params: { vis_uid: userId } }
}

/** Kullanıcının rolünü getir. */
export async function getUserRole(userId: string): Promise<string> {
    const rows = await executeQuery(`SELECT role FROM profiles WHERE id = :id`, { id: userId })
    return rows[0]?.role || rows[0]?.ROLE || 'user'
}

/** Rol + şubeyi birlikte getir (görünürlük için). */
export async function getUserRoleAndBranch(userId: string): Promise<{ role: string; branch: string | null }> {
    const rows = await executeQuery(`SELECT role, branch FROM profiles WHERE id = :id`, { id: userId })
    const r = rows[0] || {}
    return { role: r.role || r.ROLE || 'user', branch: r.branch ?? r.BRANCH ?? null }
}

export function isAdminRole(role: string): boolean {
    return PRIVILEGED_ROLES.includes(role)
}

/**
 * Görevi GÖRME/DÜZENLEME erişimi. Liste görünürlüğüyle birebir AYNI mantık —
 * böylece listede görünen görev detay/güncellemede 403 vermez.
 */
export async function checkTaskAccess(taskId: string, userId: string): Promise<AccessResult> {
    const { role, branch } = await getUserRoleAndBranch(userId)
    if (isAdminRole(role)) return { allowed: true, role }

    if (role === 'secretary' && branch) {
        const rows = await executeQuery(
            `SELECT 1 AS ok FROM tasks t WHERE t.id = :tid AND t.branch = :br`,
            { tid: taskId, br: branch }
        )
        return rows.length > 0 ? { allowed: true, role } : { allowed: false, role, reason: 'Bu göreve erişim yetkiniz yok.' }
    }

    const rows = await executeQuery(
        `SELECT 1 AS ok FROM tasks t WHERE t.id = :vis_task_id AND ${TASK_VISIBILITY_SQL}`,
        { vis_task_id: taskId, vis_uid: userId }
    )
    if (rows.length > 0) return { allowed: true, role }
    return { allowed: false, role, reason: 'Bu göreve erişim yetkiniz yok.' }
}

/**
 * Görevi SİLME erişimi (daha dar): oluşturan, klasör sahibi veya admin/superadmin.
 */
export async function checkTaskDeleteAccess(taskId: string, userId: string): Promise<AccessResult> {
    const role = await getUserRole(userId)
    if (isAdminRole(role)) return { allowed: true, role }

    const rows = await executeQuery(
        `SELECT 1 AS ok FROM dual WHERE EXISTS (
            SELECT 1 FROM tasks WHERE id = :task_id AND created_by = :user_id
        ) OR EXISTS (
            SELECT 1 FROM tasks t
            JOIN lists l ON t.list_id = l.id
            JOIN folders f ON l.folder_id = f.id
            WHERE t.id = :task_id AND f.user_id = :user_id
        )`,
        { task_id: taskId, user_id: userId }
    )
    if (rows.length > 0) return { allowed: true, role }
    return { allowed: false, role, reason: 'Bu görevi silme yetkiniz yok. Sadece oluşturan, klasör sahibi veya yöneticiler silebilir.' }
}

/**
 * Klasör erişimi: sahibi, (hiyerarşik) üyesi, departman eşleşmesi veya admin.
 */
export async function checkFolderAccess(folderId: string, userId: string): Promise<AccessResult> {
    const role = await getUserRole(userId)
    if (isAdminRole(role)) return { allowed: true, role }

    const rows = await executeQuery(
        `SELECT 1 AS ok FROM folders f WHERE f.id = :fid AND (
            f.user_id = :uid
            OR EXISTS (
                SELECT 1 FROM folder_members fm
                WHERE fm.user_id = :uid
                  AND fm.folder_id IN (
                      SELECT af.id FROM folders af START WITH af.id = f.id CONNECT BY PRIOR af.parent_id = af.id
                  )
            )
            OR EXISTS (
                SELECT 1 FROM folders pf
                JOIN user_departments ud ON ud.user_id = :uid
                JOIN departments d ON d.id = ud.department_id
                JOIN facilities fac ON fac.id = d.facility_id
                WHERE pf.id = f.id
                  AND (
                      UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                      OR UPPER(TRIM(NVL((SELECT g.title FROM folders g WHERE g.id = f.parent_id), ''))) = UPPER(TRIM(d.name))
                  )
                  AND UPPER(TRIM(NVL((SELECT g.title FROM folders g WHERE g.id = f.parent_id), f.title))) = UPPER(TRIM(fac.name))
            )
        )`,
        { fid: folderId, uid: userId }
    )
    if (rows.length > 0) return { allowed: true, role }
    return { allowed: false, role, reason: 'Bu klasöre erişim yetkiniz yok.' }
}

/**
 * Ek erişimi: yükleyen her zaman; aksi halde bağlı göreve erişim.
 */
export async function checkAttachmentAccess(attachmentId: string, userId: string): Promise<AccessResult> {
    const role = await getUserRole(userId)
    if (isAdminRole(role)) return { allowed: true, role }

    const rows = await executeQuery(
        `SELECT task_id, user_id FROM task_attachments WHERE id = :id`,
        { id: attachmentId }
    )
    if (rows.length === 0) return { allowed: false, role, reason: 'Ek bulunamadı.' }

    const att = rows[0]
    const taskId = att.task_id || att.TASK_ID
    const uploaderId = att.user_id || att.USER_ID
    if (uploaderId === userId) return { allowed: true, role }

    return checkTaskAccess(taskId, userId)
}

/** Yönetimsel endpoint'ler için (stats vb.). */
export async function requireManagerRole(userId: string): Promise<AccessResult> {
    const role = await getUserRole(userId)
    if (role === 'admin' || role === 'superadmin' || role === 'secretary') {
        return { allowed: true, role }
    }
    return { allowed: false, role, reason: 'Bu işlem için yönetici yetkisi gerekli.' }
}
