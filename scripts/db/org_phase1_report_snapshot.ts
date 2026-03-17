import oracledb from 'oracledb'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
    const connection = await oracledb.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectionString: process.env.ORACLE_CONN_STRING || process.env.ORACLE_CONNECTION_STRING
    })

    try {
        const tables = await connection.execute(
            `SELECT table_name
             FROM user_tables
             WHERE table_name IN (
                 'EBG_FACILITIES',
                 'EBG_DEPARTMENTS',
                 'EBG_USER_FACILITIES',
                 'EBG_USER_DEPARTMENTS',
                 'EBG_ROLE_PERMISSIONS'
             )
             ORDER BY table_name`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        const synonyms = await connection.execute(
            `SELECT synonym_name, table_name
             FROM user_synonyms
             WHERE synonym_name IN (
                 'FACILITIES',
                 'DEPARTMENTS',
                 'USER_FACILITIES',
                 'USER_DEPARTMENTS',
                 'ROLE_PERMISSIONS'
             )
             ORDER BY synonym_name`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        const profileCols = await connection.execute(
            `SELECT column_name
             FROM user_tab_columns
             WHERE table_name = 'EBG_PROFILES'
               AND column_name IN ('PRIMARY_FACILITY_ID', 'USER_STATUS')
             ORDER BY column_name`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        const counts = await connection.execute(
            `SELECT
                (SELECT COUNT(*) FROM facilities) AS facilities_count,
                (SELECT COUNT(*) FROM departments) AS departments_count,
                (SELECT COUNT(*) FROM role_permissions) AS permissions_count,
                (SELECT COUNT(*) FROM user_facilities) AS user_facilities_count,
                (SELECT COUNT(*) FROM user_departments) AS user_departments_count
             FROM dual`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        const sampleFacilities = await connection.execute(
            `SELECT id, name, code, is_active
             FROM facilities
             ORDER BY name
             FETCH FIRST 10 ROWS ONLY`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        const permissions = await connection.execute(
            `SELECT role_name, permission_key, is_allowed
             FROM role_permissions
             ORDER BY role_name, permission_key`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        const report = {
            generated_at: new Date().toISOString(),
            schema_evidence: {
                tables: tables.rows,
                synonyms: synonyms.rows,
                profile_columns: profileCols.rows
            },
            data_evidence: {
                counts: counts.rows?.[0] || {},
                facilities_sample: sampleFacilities.rows,
                role_permissions: permissions.rows
            }
        }

        console.log(JSON.stringify(report, null, 2))
    } finally {
        await connection.close()
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
