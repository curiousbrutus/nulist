import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool, executeQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
    await initializePool()

    const rows = await executeQuery(
        `SELECT object_name, policy_name, pf_owner, package, function, sel, ins, upd, del, enable
         FROM user_policies
         WHERE object_name IN (
            'FOLDERS','LISTS','TASKS','COMMENTS','TASK_ATTACHMENTS','TASK_ASSIGNEES','FOLDER_MEMBERS',
            'EBG_FOLDERS','EBG_LISTS','EBG_TASKS','EBG_COMMENTS','EBG_TASK_ATTACHMENTS','EBG_TASK_ASSIGNEES','EBG_FOLDER_MEMBERS'
         )
         ORDER BY object_name, policy_name`
    )

    console.log('--- VPD Bindings ---')
    console.table(rows)
}

main()
    .catch((error) => {
        console.error('check_vpd_bindings failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
