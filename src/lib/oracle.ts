import oracledb from 'oracledb'
import fs from 'fs'
import path from 'path'

// Connection Pool
let pool: any = null

/**
 * Oracle config'i al (lazy load - runtime'da env değerlerini oku)
 */
function getOracleConfig() {
    return {
        user: process.env.ORACLE_USER!,
        password: process.env.ORACLE_PASSWORD!,
        connectString: process.env.ORACLE_CONN_STRING!
    }
}

/**
 * Oracle Connection Pool'u başlat
 * Pool Configuration for high-load Next.js environments:
 * - poolMin: Minimum connections kept alive
 * - poolMax: Maximum concurrent connections
 * - poolIncrement: Connections added when pool is exhausted
 * - poolTimeout: Idle timeout in seconds (0 = keep alive indefinitely)
 * - queueTimeout: Max wait time for connection when pool is exhausted (ms)
 */
export async function initializePool() {
    if (pool) return pool

    try {
        const config = getOracleConfig()

        // CLOB ve NCLOB tiplerini otomatik olarak string'e çevir
        // Bu comments.content ve tasks.notes gibi alanların düzgün gelmesini sağlar
        oracledb.fetchAsString = [oracledb.CLOB, oracledb.NCLOB]

        pool = await oracledb.createPool({
            ...config,
            poolMin: 2,
            poolMax: 20, // Increased for higher load
            poolIncrement: 2,
            poolTimeout: 60,
            queueTimeout: 60000,
            enableStatistics: true
        })
        console.log('✅ Oracle Connection Pool başarıyla oluşturuldu')
        return pool
    } catch (error) {
        console.error('❌ Oracle Pool oluşturma hatası:', error)
        throw error
    }
}

/**
 * Pool'dan bağlantı al
 */
export async function getConnection(userId?: string): Promise<any> {
    if (!pool) {
        await initializePool()
    }

    try {
        const connection = await pool!.getConnection()

        // Eğer userId verilmişse VPD context'i ayarla
        if (userId) {
            // console.log(`[Oracle] Setting session user: ${userId}`); // Debug log
            await connection.execute(
                `BEGIN pkg_session_mgr.set_user(:u); END;`,
                { u: { val: userId, dir: oracledb.BIND_IN, type: oracledb.STRING } }
            )
        }

        return connection
    } catch (error) {
        console.error('❌ Oracle bağlantı hatası:', error)
        throw error
    }
}

/**
 * Pool'u kapat (uygulama kapatılırken)
 */
export async function closePool() {
    if (pool) {
        try {
            await pool.close(10)
            pool = null
            console.log('✅ Oracle Pool kapatıldı')
        } catch (error) {
            console.error('❌ Pool kapatma hatası:', error)
        }
    }
}

/**
 * SQL Query Helper - SELECT sorguları için
 */
/**
 * Circular reference'ları temizle (Oracle metadata objelerini kaldır)
 */
function cleanOracleObject(obj: any): any {
    if (obj === null || obj === undefined) return obj
    if (typeof obj !== 'object') return obj

    // Array ise
    if (Array.isArray(obj)) {
        return obj.map(item => cleanOracleObject(item))
    }

    // Object ise - sadece primitive değerleri al ve key'leri lowercase yap
    const cleaned: any = {}
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key]
            const lowercaseKey = key.toLowerCase()

            // Primitive types ve Date'leri al
            if (value === null ||
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean' ||
                value instanceof Date ||
                Buffer.isBuffer(value)) {
                cleaned[lowercaseKey] = value
            } else if (typeof value === 'object' && value.constructor && !value.constructor.name?.includes('Lob')) {
                // Nested object (ama Oracle Lob değilse)
                cleaned[lowercaseKey] = cleanOracleObject(value)
            }
        }
    }
    return cleaned
}

/**
 * SQL içindeki named bind placeholder'ları çıkar (:name pattern)
 * String literal'lar ve comment'ler içindeki false positive'leri filtreler.
 */
function extractBindNames(sql: string): Set<string> {
    // String literal'ları kaldır ('...' içindekiler)
    let cleaned = sql.replace(/'[^']*'/g, "''")
    // Tek satır yorumları kaldır
    cleaned = cleaned.replace(/--[^\n]*/g, '')
    // Çok satırlı yorumları kaldır
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
    const matches = cleaned.match(/:[a-zA-Z_]\w*/g)
    return new Set((matches || []).map(m => m.substring(1)))
}

/**
 * Sadece SQL'deki bind placeholder'larla eşleşen parametreleri geçir.
 * Extra key varsa kaldırır, SQL'de bind yoksa boş obje döner.
 */
function sanitizeBindParams(sql: string, params: any): Record<string, any> {
    const bindNames = extractBindNames(sql)
    if (bindNames.size === 0) {
        return {} // SQL'de bind yok, params geçme
    }
    if (!params || typeof params !== 'object') {
        return {}
    }
    const safe: Record<string, any> = {}
    for (const name of bindNames) {
        if (name in params) {
            safe[name] = params[name]
        }
    }
    return safe
}

export async function executeQuery<T = any>(
    sql: string,
    params: any = {},
    userId?: string
): Promise<T[]> {
    // Safety check: if params is a string, it's likely the userId was passed as the second argument
    if (typeof params === 'string' && userId === undefined) {
        userId = params
        params = {}
    }
    
    let connection: any = null

    try {
        connection = await getConnection(userId)
        const executeOptions = {
            outFormat: (oracledb as any).OUT_FORMAT_OBJECT,
            autoCommit: false
        }

        // NJS-098 koruması: sadece SQL'deki bind'larla eşleşen params geçir
        const safeParams = sanitizeBindParams(sql, params)
        const result = await connection.execute(sql, safeParams, executeOptions)

        // Oracle'dan dönen veriyi temizle (circular reference'ları kaldır)
        const rows = result.rows || []
        return rows.map((row: any) => cleanOracleObject(row)) as T[]
    } catch (error: any) {
        const paramsStr = JSON.stringify(params || {})
        const detailedError = new Error(`❌ Query Hatası: ${error.message}\nSQL: ${sql}\nParams: ${paramsStr}\nUserId: ${userId}`)
        ;(detailedError as any).code = error.code
        throw detailedError
    } finally {
        if (connection) {
            try {
                await connection.close()
            } catch (err) {
                console.error('Bağlantı kapatma hatası:', err)
            }
        }
    }
}

/**
 * SQL Execute Helper - INSERT/UPDATE/DELETE için
 */
export async function executeNonQuery(
    sql: string,
    params: any = {},
    userId?: string
): Promise<any> {
    // Safety check: if params is a string, it's likely the userId was passed as the second argument
    if (typeof params === 'string' && userId === undefined) {
        userId = params
        params = {}
    }
    
    let connection: any = null

    try {
        connection = await getConnection(userId)
        // NJS-098 koruması: sadece SQL'deki bind'larla eşleşen params geçir
        const safeParams = sanitizeBindParams(sql, params)
        const result = await connection.execute(sql, safeParams, {
            autoCommit: true
        })

        return result
    } catch (error: any) {
        const paramsStr = JSON.stringify(params || {})
        const detailedError = new Error(`❌ Execute Hatası: ${error.message}\nSQL: ${sql}\nParams: ${paramsStr}\nUserId: ${userId}`)
        ;(detailedError as any).code = error.code
        throw detailedError
    } finally {
        if (connection) {
            try {
                await connection.close()
            } catch (err) {
                console.error('Bağlantı kapatma hatası:', err)
            }
        }
    }
}

/**
 * Transaction Helper - Birden fazla işlem için
 */
export async function executeTransaction(
    operations: (conn: any) => Promise<void>,
    userId?: string
): Promise<void> {
    let connection: any = null

    try {
        connection = await getConnection(userId)

        // Transaction başlat
        await operations(connection)

        // Commit
        await connection.commit()
    } catch (error) {
        // Hata durumunda rollback
        if (connection) {
            try {
                await connection.rollback()
            } catch (rollbackErr) {
                console.error('Rollback hatası:', rollbackErr)
            }
        }
        console.error('❌ Transaction hatası:', error)
        throw error
    } finally {
        if (connection) {
            try {
                await connection.close()
            } catch (err) {
                console.error('Bağlantı kapatma hatası:', err)
            }
        }
    }
}

/**
 * UUID Helper - Oracle SYS_GUID() sonucunu string'e çevir
 */
export function oracleUuidToString(raw: any): string {
    if (!raw) return ''
    // Oracle RAW tipini string UUID'ye çevir
    return Buffer.from(raw).toString('hex').toLowerCase()
}

/**
 * Sayfa bazlı sonuçlar için helper (Pagination)
 */
export async function executeQueryWithPagination<T = any>(
    sql: string,
    params: any = {},
    page: number = 1,
    pageSize: number = 20,
    userId?: string
): Promise<{ data: T[], totalCount: number }> {
    const offset = (page - 1) * pageSize

    // COUNT query
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`
    const countResult = await executeQuery<{ TOTAL: number }>(countSql, params, userId)
    const totalCount = countResult[0]?.TOTAL || 0

    // Data query with pagination
    const paginatedSql = `
        SELECT * FROM (
            SELECT a.*, ROWNUM rnum FROM (
                ${sql}
            ) a
            WHERE ROWNUM <= :endRow
        )
        WHERE rnum > :startRow
    `

    const data = await executeQuery<T>(
        paginatedSql,
        {
            ...params,
            startRow: offset,
            endRow: offset + pageSize
        },
        userId
    )

    return { data, totalCount }
}
