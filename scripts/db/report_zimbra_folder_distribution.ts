import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool, executeQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
    await initializePool()

    const byTitle = await executeQuery(
        `SELECT title, COUNT(*) AS cnt
         FROM folders
         WHERE UPPER(TRIM(title)) = UPPER(TRIM(:title))
         GROUP BY title
         ORDER BY cnt DESC`,
        { title: 'Zimbra Görevleri' }
    )

    const byOwner = await executeQuery(
        `SELECT COUNT(DISTINCT user_id) AS owner_cnt
         FROM folders
         WHERE UPPER(TRIM(title)) = UPPER(TRIM(:title))`,
        { title: 'Zimbra Görevleri' }
    )

    const byUser = await executeQuery(
        `SELECT user_id, COUNT(*) AS cnt
         FROM folders
         WHERE UPPER(TRIM(title)) = UPPER(TRIM(:title))
         GROUP BY user_id
         ORDER BY cnt DESC, user_id ASC`,
        { title: 'Zimbra Görevleri' }
    )

    console.log('--- By Title ---')
    console.table(byTitle)
    console.log('--- Owner Count ---')
    console.table(byOwner)
    console.log('--- By User (top) ---')
    console.table(byUser.slice(0, 20))
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
