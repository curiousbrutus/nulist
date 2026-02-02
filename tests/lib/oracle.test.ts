import { describe, it, expect, vi, beforeEach } from 'vitest'

const createPoolMock = vi.fn()
const getConnectionMock = vi.fn()
const executeMock = vi.fn()
const closeMock = vi.fn()

vi.mock('oracledb', () => {
  return {
    default: {
      CLOB: 'CLOB',
      NCLOB: 'NCLOB',
      fetchAsString: [] as any,
      createPool: createPoolMock
    }
  }
})

beforeEach(() => {
  createPoolMock.mockReset()
  getConnectionMock.mockReset()
  executeMock.mockReset()
  closeMock.mockReset()
})

it('initializePool creates a pool with env config', async () => {
  const fakeConn = { execute: executeMock, close: closeMock }
  const fakePool = { getConnection: getConnectionMock }
  getConnectionMock.mockResolvedValue(fakeConn)
  createPoolMock.mockResolvedValue(fakePool)

  const { initializePool } = await import('@/lib/oracle')
  const pool = await initializePool()

  expect(createPoolMock).toHaveBeenCalledTimes(1)
  expect(pool).toBe(fakePool)
})

it('getConnection sets VPD context when userId provided', async () => {
  const fakeConn = { execute: executeMock, close: closeMock }
  const fakePool = { getConnection: getConnectionMock }
  getConnectionMock.mockResolvedValue(fakeConn)
  createPoolMock.mockResolvedValue(fakePool)

  const { getConnection } = await import('@/lib/oracle')
  await getConnection('user_123')

  expect(executeMock).toHaveBeenCalledWith(
    'BEGIN pkg_session_mgr.set_user(:userId); END;',
    { userId: 'user_123' }
  )
})
