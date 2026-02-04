/**
 * NeoList - Veritabanı Migrasyon Scripti
 * Tüm SQL migrasyonlarını sırayla çalıştırır
 */

import oracledb from 'oracledb'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations')

interface Migration {
    version: number
    name: string
    file: string
}

async function getMigrations(): Promise<Migration[]> {
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort()
    
    return files.map(file => {
        const match = file.match(/^(\d+)_(.+)\.sql$/)
        if (!match) return null
        return {
            version: parseInt(match[1]),
            name: match[2].replace(/_/g, ' '),
            file
        }
    }).filter(Boolean) as Migration[]
}

async function getAppliedMigrations(connection: any): Promise<number[]> {
    try {
        const result = await connection.execute(
            `SELECT version FROM schema_migrations ORDER BY version`
        )
        return result.rows?.map((r: any) => r.VERSION) || []
    } catch {
        // Table doesn't exist, create it
        await connection.execute(`
            CREATE TABLE schema_migrations (
                version NUMBER PRIMARY KEY,
                name VARCHAR2(255),
                applied_at TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        `)
        await connection.commit()
        return []
    }
}

async function runMigration(connection: any, migration: Migration): Promise<void> {
    const sqlPath = path.join(MIGRATIONS_DIR, migration.file)
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    
    // Split by semicolon and filter empty statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
        try {
            await connection.execute(statement)
        } catch (error) {
            // Ignore "already exists" errors
            const err = error as { errorNum?: number }
            if (err.errorNum !== 955 && err.errorNum !== 1430 && err.errorNum !== 942) {
                throw error
            }
        }
    }
    
    // Record migration
    await connection.execute(
        `INSERT INTO schema_migrations (version, name) VALUES (:version, :name)`,
        { version: migration.version, name: migration.name }
    )
    await connection.commit()
}

async function main() {
    console.log('\n🗄️  NeoList Veritabanı Migrasyonları\n')
    console.log('═'.repeat(50))
    
    const connection = await oracledb.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectionString: process.env.ORACLE_CONN_STRING || process.env.ORACLE_CONNECTION_STRING
    })
    
    try {
        const migrations = await getMigrations()
        const applied = await getAppliedMigrations(connection)
        
        const pending = migrations.filter(m => !applied.includes(m.version))
        
        if (pending.length === 0) {
            console.log('✅ Tüm migrasyonlar zaten uygulanmış.\n')
            return
        }
        
        console.log(`📋 ${pending.length} migrasyon bekliyor:\n`)
        
        for (const migration of pending) {
            process.stdout.write(`  [${migration.version.toString().padStart(3, '0')}] ${migration.name}...`)
            await runMigration(connection, migration)
            console.log(' ✅')
        }
        
        console.log('\n✅ Tüm migrasyonlar başarıyla uygulandı!\n')
    } finally {
        await connection.close()
    }
}

main().catch(err => {
    console.error('\n❌ Migrasyon hatası:', err.message)
    process.exit(1)
})
