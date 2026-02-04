import { vi } from 'vitest'

// Basic env defaults for tests
process.env.ORACLE_USER = process.env.ORACLE_USER || 'test_user'
process.env.ORACLE_PASSWORD = process.env.ORACLE_PASSWORD || 'test_pass'
process.env.ORACLE_CONN_STRING = process.env.ORACLE_CONN_STRING || 'localhost:1521/XEPDB1'
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test_key'

// Ensure clean mocks between tests
afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})
