import oracledb from 'oracledb'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const IGNORABLE_ERRORS = new Set([955, 1430, 942, 2275, 2261, 904])

async function executeSafe(connection: any, sql: string, binds: Record<string, any> = {}) {
  try {
    await connection.execute(sql, binds)
  } catch (error: any) {
    if (!IGNORABLE_ERRORS.has(error?.errorNum)) {
      throw error
    }
  }
}

async function tableExists(connection: any, tableName: string): Promise<boolean> {
  const result = await connection.execute(
    `SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name = :table_name`,
    { table_name: tableName },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  )

  const count = Number((result.rows?.[0] as any)?.CNT ?? 0)
  return count > 0
}

async function renameIfNeeded(connection: any, oldName: string, newName: string) {
  const oldExists = await tableExists(connection, oldName)
  const newExists = await tableExists(connection, newName)

  if (oldExists && !newExists) {
    await connection.execute(`RENAME ${oldName} TO ${newName}`)
  }
}

async function main() {
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectionString: process.env.ORACLE_CONN_STRING || process.env.ORACLE_CONNECTION_STRING,
  })

  try {
    // 1) Ensure migration 014 structures on existing (legacy) table names
    await executeSafe(connection, `
      CREATE TABLE profile_managers (
        profile_id VARCHAR2(36) NOT NULL,
        manager_id VARCHAR2(36) NOT NULL,
        is_primary NUMBER(1) DEFAULT 0 NOT NULL,
        assigned_by VARCHAR2(36),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT pk_profile_managers PRIMARY KEY (profile_id, manager_id),
        CONSTRAINT fk_pm_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        CONSTRAINT fk_pm_manager FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE CASCADE,
        CONSTRAINT fk_pm_assigned_by FOREIGN KEY (assigned_by) REFERENCES profiles(id),
        CONSTRAINT chk_pm_not_self CHECK (profile_id <> manager_id),
        CONSTRAINT chk_pm_primary CHECK (is_primary IN (0, 1))
      )
    `)

    await executeSafe(connection, `CREATE INDEX idx_pm_profile ON profile_managers(profile_id)`)
    await executeSafe(connection, `CREATE INDEX idx_pm_manager ON profile_managers(manager_id)`)

    await executeSafe(connection, `
      INSERT INTO profile_managers (profile_id, manager_id, is_primary, assigned_by)
      SELECT p.id, p.manager_id, 1, p.id
      FROM profiles p
      WHERE p.manager_id IS NOT NULL
        AND p.id <> p.manager_id
        AND NOT EXISTS (
          SELECT 1 FROM profile_managers pm
          WHERE pm.profile_id = p.id AND pm.manager_id = p.manager_id
        )
    `)

    await executeSafe(connection, `ALTER TABLE tasks ADD recurrence_enabled NUMBER(1) DEFAULT 0 NOT NULL`)
    await executeSafe(connection, `ALTER TABLE tasks ADD recurrence_mode VARCHAR2(30)`)
    await executeSafe(connection, `ALTER TABLE tasks ADD recurrence_interval_days NUMBER`)
    await executeSafe(connection, `ALTER TABLE tasks ADD recurrence_parent_task_id VARCHAR2(36)`)
    await executeSafe(connection, `
      ALTER TABLE tasks ADD CONSTRAINT fk_tasks_recurrence_parent
      FOREIGN KEY (recurrence_parent_task_id) REFERENCES tasks(id)
    `)
    await executeSafe(connection, `
      ALTER TABLE tasks ADD CONSTRAINT chk_tasks_recurrence_mode
      CHECK (recurrence_mode IN ('fixed_schedule', 'completion_driven') OR recurrence_mode IS NULL)
    `)
    await executeSafe(connection, `
      ALTER TABLE tasks ADD CONSTRAINT chk_tasks_recurrence_enabled
      CHECK (recurrence_enabled IN (0, 1))
    `)
    await executeSafe(connection, `
      ALTER TABLE tasks ADD CONSTRAINT chk_tasks_recurrence_interval
      CHECK (recurrence_interval_days IS NULL OR recurrence_interval_days >= 1)
    `)
    await executeSafe(connection, `CREATE INDEX idx_tasks_recurrence_parent ON tasks(recurrence_parent_task_id)`)

    // 2) Rename project tables with EBG_ prefix
    const renamePairs: Array<[string, string]> = [
      ['PROFILES', 'EBG_PROFILES'],
      ['FOLDERS', 'EBG_FOLDERS'],
      ['FOLDER_MEMBERS', 'EBG_FOLDER_MEMBERS'],
      ['LISTS', 'EBG_LISTS'],
      ['TASKS', 'EBG_TASKS'],
      ['TASK_ASSIGNEES', 'EBG_TASK_ASSIGNEES'],
      ['COMMENTS', 'EBG_COMMENTS'],
      ['TASK_ATTACHMENTS', 'EBG_TASK_ATTACHMENTS'],
      ['SYNC_QUEUE', 'EBG_SYNC_QUEUE'],
      ['PROFILE_MANAGERS', 'EBG_PROFILE_MANAGERS'],
      ['SCHEMA_MIGRATIONS', 'EBG_SCHEMA_MIGRATIONS'],
    ]

    for (const [oldName, newName] of renamePairs) {
      await renameIfNeeded(connection, oldName, newName)
    }

    // 3) Create synonyms so existing SQL continues to work without mass code refactor
    const synonyms: Array<[string, string]> = [
      ['PROFILES', 'EBG_PROFILES'],
      ['FOLDERS', 'EBG_FOLDERS'],
      ['FOLDER_MEMBERS', 'EBG_FOLDER_MEMBERS'],
      ['LISTS', 'EBG_LISTS'],
      ['TASKS', 'EBG_TASKS'],
      ['TASK_ASSIGNEES', 'EBG_TASK_ASSIGNEES'],
      ['COMMENTS', 'EBG_COMMENTS'],
      ['TASK_ATTACHMENTS', 'EBG_TASK_ATTACHMENTS'],
      ['SYNC_QUEUE', 'EBG_SYNC_QUEUE'],
      ['PROFILE_MANAGERS', 'EBG_PROFILE_MANAGERS'],
      ['SCHEMA_MIGRATIONS', 'EBG_SCHEMA_MIGRATIONS'],
    ]

    for (const [synonymName, targetTable] of synonyms) {
      await executeSafe(connection, `CREATE OR REPLACE SYNONYM ${synonymName} FOR ${targetTable}`)
    }

    // 4) Mark migrations 14 and 15 as applied (via synonym SCHEMA_MIGRATIONS)
    await executeSafe(
      connection,
      `INSERT INTO schema_migrations (version, name) VALUES (:version, :name)`,
      { version: 14, name: 'add profile managers and task recurrence' }
    )

    await executeSafe(
      connection,
      `INSERT INTO schema_migrations (version, name) VALUES (:version, :name)`,
      { version: 15, name: 'prefix tables with ebg' }
    )

    await connection.commit()
    console.log('✅ EBG table prefix and compatibility synonyms applied successfully.')
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.close()
  }
}

main().catch((error) => {
  console.error('❌ apply_ebg_prefix failed:', error)
  process.exit(1)
})
