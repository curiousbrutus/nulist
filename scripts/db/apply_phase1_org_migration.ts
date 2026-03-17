import oracledb from 'oracledb'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

function splitStatements(sql: string): string[] {
    return sql
        .split(';')
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0)
        .map((statement) => statement
            .split('\n')
            .filter((line) => !line.trim().startsWith('--'))
            .join('\n')
            .trim()
        )
        .filter((statement) => statement.length > 0)
}

async function main() {
    const migrationPath = path.join(process.cwd(), 'migrations', '016_add_org_foundation_phase1.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    const statements = splitStatements(sql)

    const connection = await oracledb.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectionString: process.env.ORACLE_CONN_STRING || process.env.ORACLE_CONNECTION_STRING
    })

    try {
        console.log(`Applying ${statements.length} statements from 016_add_org_foundation_phase1.sql`) 

        for (let index = 0; index < statements.length; index++) {
            const statement = statements[index]
            try {
                await connection.execute(statement)
            } catch (error) {
                const err = error as { errorNum?: number; message?: string }
                if (err.errorNum === 955 || err.errorNum === 1430 || err.errorNum === 1) {
                    continue
                }
                console.error(`Failed statement #${index + 1}:`, statement)
                throw error
            }
        }

        await connection.commit()
        console.log('✅ Phase-1 org migration applied')
    } finally {
        await connection.close()
    }
}

main().catch((error) => {
    console.error('❌ Phase-1 migration failed:', error)
    process.exit(1)
})
