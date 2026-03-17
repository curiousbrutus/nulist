import dotenv from 'dotenv'
import path from 'path'
import { initializePool, closePool, executeQuery } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  await initializePool()

  const taskDist = await executeQuery(
    `SELECT CASE WHEN f.parent_id IS NULL THEN 'TOP_LEVEL_FOLDER' ELSE 'UNIT_FOLDER' END AS folder_level,
            COUNT(t.id) AS task_count
     FROM tasks t
     JOIN lists l ON l.id = t.list_id
     JOIN folders f ON f.id = l.folder_id
     GROUP BY CASE WHEN f.parent_id IS NULL THEN 'TOP_LEVEL_FOLDER' ELSE 'UNIT_FOLDER' END`
  )

  const listDist = await executeQuery(
    `SELECT CASE WHEN f.parent_id IS NULL THEN 'TOP_LEVEL_FOLDER' ELSE 'UNIT_FOLDER' END AS folder_level,
            COUNT(l.id) AS list_count
     FROM lists l
     JOIN folders f ON f.id = l.folder_id
     GROUP BY CASE WHEN f.parent_id IS NULL THEN 'TOP_LEVEL_FOLDER' ELSE 'UNIT_FOLDER' END`
  )

  console.log('--- Task distribution by folder level ---')
  console.table(taskDist)
  console.log('--- List distribution by folder level ---')
  console.table(listDist)
}

main()
  .catch((error) => {
    console.error('report_list_task_levels failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await closePool()
  })
