import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool, executeQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
    await initializePool()

    const roleCounts = await executeQuery(
        `SELECT role, COUNT(*) AS cnt
         FROM profiles
         GROUP BY role
         ORDER BY role`
    )

    const managerCandidates = await executeQuery(
        `SELECT COUNT(*) AS cnt
         FROM profiles p
         WHERE p.role = 'user'
           AND EXISTS (SELECT 1 FROM profiles c WHERE c.manager_id = p.id)`
    )

    const secretarySample = await executeQuery(
        `SELECT id, full_name, email
         FROM profiles
         WHERE role = 'secretary'
         FETCH FIRST 5 ROWS ONLY`
    )

    console.log('--- Role Counts ---')
    console.table(roleCounts)
    console.log('--- Manager-user candidates ---')
    console.table(managerCandidates)
    console.log('--- Secretary sample ---')
    console.table(secretarySample)
}

main()
    .catch((error) => {
        console.error('role_inventory failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
