import oracledb from 'oracledb'

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
            poolMax: 10,
            poolIncrement: 1,
            poolTimeout: 60,
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
            await connection.execute(
                `BEGIN pkg_session_mgr.set_user(:userId); END;`,
                { userId }
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

export async function executeQuery<T = any>(
    sql: string,
    params: any = {},
    userId?: string
): Promise<T[]> {
    let connection: any = null

    try {
        connection = await getConnection(userId)
        const result = await connection.execute(sql, params, {
            outFormat: (oracledb as any).OUT_FORMAT_OBJECT,
            autoCommit: false
        })

        // Oracle'dan dönen veriyi temizle (circular reference'ları kaldır)
        const rows = result.rows || []
        return rows.map((row: any) => cleanOracleObject(row)) as T[]
    } catch (error) {
        console.error('❌ Query hatası:', error)
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
 * SQL Execute Helper - INSERT/UPDATE/DELETE için
 */
export async function executeNonQuery(
    sql: string,
    params: any = {},
    userId?: string
): Promise<any> {
    let connection: any = null

    try {
        connection = await getConnection(userId)
        const result = await connection.execute(sql, params, {
            autoCommit: true
        })

        return result
    } catch (error) {
        console.error('❌ Execute hatası:', error)
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
