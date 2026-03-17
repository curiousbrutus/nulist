import dotenv from 'dotenv'
import path from 'path'
import {
    initializePool,
    closePool,
    executeQuery,
    executeTransaction
} from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const TARGET_TITLE = 'Zimbra Görevleri'

function getValue(row: any, key: string) {
    return row?.[key] ?? row?.[key.toUpperCase()]
}

async function getDuplicateGroups() {
    return await executeQuery(
        `SELECT user_id, COUNT(*) AS cnt
         FROM folders
         WHERE UPPER(TRIM(title)) = UPPER(TRIM(:title))
         GROUP BY user_id
         HAVING COUNT(*) > 1`,
        { title: TARGET_TITLE }
    )
}

async function getFoldersForUser(userId: string) {
    return await executeQuery(
        `SELECT id, user_id, title, created_at
         FROM folders
         WHERE user_id = :user_id
           AND UPPER(TRIM(title)) = UPPER(TRIM(:title))
         ORDER BY created_at ASC, id ASC`,
        { user_id: userId, title: TARGET_TITLE }
    )
}

async function mergeDuplicateFolder(connection: any, canonicalFolderId: string, duplicateFolderId: string) {
    let movedLists = 0
    let movedChildren = 0
    let movedMembers = 0
    let mergedMembers = 0
    let mergedLists = 0
    let movedTasks = 0

    const childUpdateResult = await connection.execute(
        `UPDATE folders
         SET parent_id = :canonical_id
         WHERE parent_id = :duplicate_id`,
        { canonical_id: canonicalFolderId, duplicate_id: duplicateFolderId },
        { autoCommit: false }
    )
    movedChildren += childUpdateResult.rowsAffected || 0

    const listMoveResult = await connection.execute(
        `UPDATE lists
         SET folder_id = :canonical_id
         WHERE folder_id = :duplicate_id`,
        { canonical_id: canonicalFolderId, duplicate_id: duplicateFolderId },
        { autoCommit: false }
    )
    movedLists += listMoveResult.rowsAffected || 0

    const duplicateMembers = await connection.execute(
        `SELECT user_id, role, can_add_task, can_delete_task, can_add_list, can_assign_task
         FROM folder_members
         WHERE folder_id = :folder_id`,
        { folder_id: duplicateFolderId },
        { outFormat: 4002, autoCommit: false }
    )

    for (const member of duplicateMembers.rows || []) {
        const userId = member.USER_ID
        const role = member.ROLE
        const canAddTask = Number(member.CAN_ADD_TASK || 0)
        const canDeleteTask = Number(member.CAN_DELETE_TASK || 0)
        const canAddList = Number(member.CAN_ADD_LIST || 0)
        const canAssignTask = Number(member.CAN_ASSIGN_TASK || 0)

        const existing = await connection.execute(
            `SELECT id, role, can_add_task, can_delete_task, can_add_list, can_assign_task
             FROM folder_members
             WHERE folder_id = :folder_id
               AND user_id = :user_id`,
            { folder_id: canonicalFolderId, user_id: userId },
            { outFormat: 4002, autoCommit: false }
        )

        if ((existing.rows || []).length === 0) {
            await connection.execute(
                `UPDATE folder_members
                 SET folder_id = :canonical_id
                 WHERE folder_id = :duplicate_id
                   AND user_id = :user_id`,
                {
                    canonical_id: canonicalFolderId,
                    duplicate_id: duplicateFolderId,
                    user_id: userId
                },
                { autoCommit: false }
            )
            movedMembers++
        } else {
            const existingRow = existing.rows![0] as any
            const newRole = existingRow.ROLE === 'admin' || role === 'admin' ? 'admin' : 'member'

            await connection.execute(
                `UPDATE folder_members
                 SET role = :role,
                     can_add_task = GREATEST(NVL(can_add_task,0), :can_add_task),
                     can_delete_task = GREATEST(NVL(can_delete_task,0), :can_delete_task),
                     can_add_list = GREATEST(NVL(can_add_list,0), :can_add_list),
                     can_assign_task = GREATEST(NVL(can_assign_task,0), :can_assign_task)
                 WHERE folder_id = :folder_id
                   AND user_id = :user_id`,
                {
                    role: newRole,
                    can_add_task: canAddTask,
                    can_delete_task: canDeleteTask,
                    can_add_list: canAddList,
                    can_assign_task: canAssignTask,
                    folder_id: canonicalFolderId,
                    user_id: userId
                },
                { autoCommit: false }
            )

            await connection.execute(
                `DELETE FROM folder_members
                 WHERE folder_id = :duplicate_id
                   AND user_id = :user_id`,
                {
                    duplicate_id: duplicateFolderId,
                    user_id: userId
                },
                { autoCommit: false }
            )

            mergedMembers++
        }
    }

    const canonicalLists = await connection.execute(
        `SELECT id, title
         FROM lists
         WHERE folder_id = :folder_id
         ORDER BY created_at ASC, id ASC`,
        { folder_id: canonicalFolderId },
        { outFormat: 4002, autoCommit: false }
    )

    const listTitleMap = new Map<string, string>()
    for (const row of canonicalLists.rows || []) {
        const listId = row.ID as string
        const title = String(row.TITLE || '').trim().toUpperCase()
        if (!title) continue

        if (!listTitleMap.has(title)) {
            listTitleMap.set(title, listId)
            continue
        }

        const targetListId = listTitleMap.get(title)!
        if (targetListId === listId) continue

        const taskMoveResult = await connection.execute(
            `UPDATE tasks
             SET list_id = :target_list_id
             WHERE list_id = :source_list_id`,
            { target_list_id: targetListId, source_list_id: listId },
            { autoCommit: false }
        )
        movedTasks += taskMoveResult.rowsAffected || 0

        await connection.execute(
            `DELETE FROM lists WHERE id = :id`,
            { id: listId },
            { autoCommit: false }
        )
        mergedLists++
    }

    const remainingLists = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM lists WHERE folder_id = :folder_id`,
        { folder_id: duplicateFolderId },
        { outFormat: 4002, autoCommit: false }
    )

    const remainingChildren = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM folders WHERE parent_id = :folder_id`,
        { folder_id: duplicateFolderId },
        { outFormat: 4002, autoCommit: false }
    )

    const canDelete = Number((remainingLists.rows?.[0] as any)?.CNT || 0) === 0
        && Number((remainingChildren.rows?.[0] as any)?.CNT || 0) === 0

    let deletedFolder = 0
    if (canDelete) {
        await connection.execute(
            `DELETE FROM folders WHERE id = :id`,
            { id: duplicateFolderId },
            { autoCommit: false }
        )
        deletedFolder = 1
    }

    return {
        movedLists,
        movedChildren,
        movedMembers,
        mergedMembers,
        mergedLists,
        movedTasks,
        deletedFolder,
        skippedDelete: canDelete ? 0 : 1
    }
}

async function main() {
    await initializePool()

    const beforeGroups = await getDuplicateGroups()
    const beforeTotalRows = await executeQuery(
        `SELECT COUNT(*) AS cnt
         FROM folders
         WHERE UPPER(TRIM(title)) = UPPER(TRIM(:title))`,
        { title: TARGET_TITLE }
    )

    console.log(`Before: duplicate user groups=${beforeGroups.length}, total '${TARGET_TITLE}' folders=${getValue(beforeTotalRows[0], 'cnt')}`)

    let processedGroups = 0
    let totalDeletedFolders = 0
    let totalSkippedDeletes = 0
    let totalMovedLists = 0
    let totalMovedChildren = 0
    let totalMovedMembers = 0
    let totalMergedMembers = 0
    let totalMergedLists = 0
    let totalMovedTasks = 0

    for (const group of beforeGroups) {
        const userId = String(getValue(group, 'user_id'))
        const folders = await getFoldersForUser(userId)
        if (folders.length <= 1) continue

        const canonicalFolderId = String(getValue(folders[0], 'id'))
        const duplicateFolderIds = folders.slice(1).map((row) => String(getValue(row, 'id')))

        await executeTransaction(async (connection) => {
            for (const duplicateFolderId of duplicateFolderIds) {
                const result = await mergeDuplicateFolder(connection, canonicalFolderId, duplicateFolderId)
                totalMovedLists += result.movedLists
                totalMovedChildren += result.movedChildren
                totalMovedMembers += result.movedMembers
                totalMergedMembers += result.mergedMembers
                totalMergedLists += result.mergedLists
                totalMovedTasks += result.movedTasks
                totalDeletedFolders += result.deletedFolder
                totalSkippedDeletes += result.skippedDelete
            }
        })

        processedGroups++
    }

    const afterGroups = await getDuplicateGroups()
    const afterTotalRows = await executeQuery(
        `SELECT COUNT(*) AS cnt
         FROM folders
         WHERE UPPER(TRIM(title)) = UPPER(TRIM(:title))`,
        { title: TARGET_TITLE }
    )

    console.log('--- Dedup Summary ---')
    console.log(`Processed groups: ${processedGroups}`)
    console.log(`Folders deleted: ${totalDeletedFolders}`)
    console.log(`Folders skipped delete (non-empty): ${totalSkippedDeletes}`)
    console.log(`Lists moved: ${totalMovedLists}`)
    console.log(`Child folders moved: ${totalMovedChildren}`)
    console.log(`Folder members moved: ${totalMovedMembers}`)
    console.log(`Folder members merged: ${totalMergedMembers}`)
    console.log(`Duplicate lists merged: ${totalMergedLists}`)
    console.log(`Tasks moved between lists: ${totalMovedTasks}`)
    console.log(`After: duplicate user groups=${afterGroups.length}, total '${TARGET_TITLE}' folders=${getValue(afterTotalRows[0], 'cnt')}`)
}

main()
    .catch((error) => {
        console.error('Dedup failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
