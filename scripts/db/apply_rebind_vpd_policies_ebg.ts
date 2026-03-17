import fs from 'fs'
import path from 'path'
import oracledb from 'oracledb'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

function extractPlSqlBlocks(sql: string): string[] {
    const cleaned = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')

    return cleaned
        .split(/^\/$/m)
        .map((block) => block.trim())
        .filter((block) => block.length > 0)
}

async function main() {
    const sqlPath = path.join(process.cwd(), 'migrations', '019_rebind_vpd_policies_ebg.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    const blocks = extractPlSqlBlocks(sql)

    const connection = await oracledb.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectionString: process.env.ORACLE_CONN_STRING || process.env.ORACLE_CONNECTION_STRING
    })

    try {
        console.log(`Applying ${blocks.length} PL/SQL blocks from 019_rebind_vpd_policies_ebg.sql`)
        for (const block of blocks) {
            await connection.execute(block)
        }
        await connection.commit()
        console.log('✅ VPD policy rebinding applied on EBG_* tables')
    } finally {
        await connection.close()
    }
}

main().catch((error) => {
    console.error('❌ Rebind VPD policies failed:', error)
    process.exit(1)
})
