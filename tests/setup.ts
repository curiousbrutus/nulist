import { vi } from 'vitest'

// Basic env defaults for tests
process.env.ORACLE_USER = process.env.ORACLE_USER || 'test_user'
process.env.ORACLE_PASSWORD = process.env.ORACLE_PASSWORD || 'test_pass'
process.env.ORACLE_CONN_STRING = process.env.ORACLE_CONN_STRING || 'localhost:1521/XEPDB1'
process.env.OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434'
process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b'

// Ensure clean mocks between tests
afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})
