
import { getConnection, closePool } from '../../src/lib/oracle'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local')
console.log(`Loading env from: ${envPath}`)
const result = dotenv.config({ path: envPath })

if (result.error) {
    console.error('Error loading .env file:', result.error)
}

async function testConnection() {
    console.log('--- Oracle DB Connection Test ---')
    console.log(`User: ${process.env.ORACLE_USER}`)
    console.log(`Connection String: ${process.env.ORACLE_CONN_STRING}`)
    
    let conn;
    try {
        console.log('Initializing pool and getting connection...')
        conn = await getConnection()
        console.log('✅ Connection successful!')

        console.log('Executing test query (SELECT SYSDATE FROM DUAL)...')
        const result = await conn.execute(`SELECT SYSDATE FROM DUAL`)
        console.log('Query Result:', result.rows)
        
        console.log('Test complete.')
    } catch (err) {
        console.error('❌ Connection failed:', err)
    } finally {
        if (conn) {
            try {
                await conn.close()
                console.log('Connection closed.')
            } catch(e) { console.error('Error closing connection', e)}
        }
        await closePool()
        console.log('Pool closed.')
    }
}

testConnection()
