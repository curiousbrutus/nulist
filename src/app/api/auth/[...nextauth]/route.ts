import { handlers } from '@/auth'

export const { GET, POST } = handlers

// Force Node.js runtime for OracleDB compatibility
export const runtime = 'nodejs'
