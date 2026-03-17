/**
 * Uygulama-katmanı yetki kontrol helper'ları.
 * VPD politikaları DB'de devre dışı olduğundan, erişim kontrolü burada yapılıyor.
 *
 * Kullanım:
 *   const access = await checkTaskAccess(taskId, userId)
 *   if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 })
 */
import { executeQuery } from '@/lib/oracle'

export interface AccessResult {
    allowed: boolean
    reason?: string
    role?: string
}

/**
 * Kullanıcının rolünü getir. Admin/superadmin her yere erişebilir.
 */
export async function getUserRole(userId: string): Promise<string> {
    const rows = await executeQuery(
        `SELECT role FROM profiles WHERE id = :id`,
        { id: userId }
    )
    return rows[0]?.role || rows[0]?.ROLE || 'user'
}

/**
 * Kullanıcının admin veya superadmin olup olmadığını kontrol et.
 */
export function isAdminRole(role: string): boolean {
    return role === 'admin' || role === 'superadmin'
}

/**
 * Kullanıcının belirtilen göreve erişimi var mı?
 * Erişim koşulları:
 *   - Admin/superadmin → her zaman
 *   - Görevin oluşturucusu
 *   - Göreve atanmış
 *   - Görevin bulunduğu klasörün sahibi
 *   - Görevin bulunduğu klasörün üyesi
 */
export async function checkTaskAccess(taskId: string, userId: string): Promise<AccessResult> {
    const role = await getUserRole(userId)
    if (isAdminRole(role)) return { allowed: true, role }

    const rows = await executeQuery(
        `SELECT 1 AS ok FROM dual WHERE EXISTS (
            SELECT 1 FROM tasks WHERE id = :task_id AND created_by = :user_id
        ) OR EXISTS (
            SELECT 1 FROM task_assignees WHERE task_id = :task_id AND user_id = :user_id
        ) OR EXISTS (
            SELECT 1 FROM tasks t
            JOIN lists l ON t.list_id = l.id
            JOIN folders f ON l.folder_id = f.id
            WHERE t.id = :task_id AND f.user_id = :user_id
        ) OR EXISTS (
            SELECT 1 FROM tasks t
            JOIN lists l ON t.list_id = l.id
            JOIN folder_members fm ON l.folder_id = fm.folder_id
            WHERE t.id = :task_id AND fm.user_id = :user_id
        )`,
        { task_id: taskId, user_id: userId }
    )

    if (rows.length > 0) return { allowed: true, role }
    return { allowed: false, role, reason: 'Bu göreve erişim yetkiniz yok.' }
}

/**
 * Kullanıcının belirtilen klasöre erişimi var mı?
 * Erişim koşulları:
 *   - Admin/superadmin → her zaman
 *   - Klasörün sahibi
 *   - Klasörün üyesi
 */
export async function checkFolderAccess(folderId: string, userId: string): Promise<AccessResult> {
    const role = await getUserRole(userId)
    if (isAdminRole(role)) return { allowed: true, role }

    const rows = await executeQuery(
        `SELECT 1 AS ok FROM dual WHERE EXISTS (
            SELECT 1 FROM folders WHERE id = :folder_id AND user_id = :user_id
        ) OR EXISTS (
            SELECT 1 FROM folder_members WHERE folder_id = :folder_id AND user_id = :user_id
        )`,
        { folder_id: folderId, user_id: userId }
    )

    if (rows.length > 0) return { allowed: true, role }
    return { allowed: false, role, reason: 'Bu klasöre erişim yetkiniz yok.' }
}

/**
 * Kullanıcının belirtilen eki olan göreve erişimi var mı?
 */
export async function checkAttachmentAccess(attachmentId: string, userId: string): Promise<AccessResult> {
    const role = await getUserRole(userId)
    if (isAdminRole(role)) return { allowed: true, role }

    // Ek'in bağlı olduğu task'ı bul, sonra task erişimini kontrol et
    const rows = await executeQuery(
        `SELECT task_id, user_id FROM task_attachments WHERE id = :id`,
        { id: attachmentId }
    )
    if (rows.length === 0) return { allowed: false, role, reason: 'Ek bulunamadı.' }

    const att = rows[0]
    const taskId = att.task_id || att.TASK_ID
    const uploaderId = att.user_id || att.USER_ID

    // Yükleyen kişi her zaman erişebilir
    if (uploaderId === userId) return { allowed: true, role }

    return checkTaskAccess(taskId, userId)
}

/**
 * Kullanıcının yönetici rollerini (admin/superadmin/secretary) kontrol et
 * Stats gibi yönetimsel endpoint'ler için
 */
export async function requireManagerRole(userId: string): Promise<AccessResult> {
    const role = await getUserRole(userId)
    if (role === 'admin' || role === 'superadmin' || role === 'secretary') {
        return { allowed: true, role }
    }
    return { allowed: false, role, reason: 'Bu işlem için yönetici yetkisi gerekli.' }
}
