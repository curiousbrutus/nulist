import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.fn()
const executeQueryMock = vi.fn()
const executeNonQueryMock = vi.fn()

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/oracle', () => ({
  executeQuery: executeQueryMock,
  executeNonQuery: executeNonQueryMock
}))

const makeRequest = (body: any) => {
  const req = new Request('http://localhost/api/tasks/task_1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return req as unknown as NextRequest
}

const makeParams = async () => ({ id: 'task_1' })

describe('PUT /api/tasks/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue(null)
    const { PUT } = await import('@/app/api/tasks/[id]/route')

    const res = await PUT(makeRequest({ notes: 'x' }), { params: makeParams() })
    expect(res.status).toBe(401)
  })

  it('returns 400 when no fields to update', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock.mockResolvedValueOnce([{ access: 1 }])
    const { PUT } = await import('@/app/api/tasks/[id]/route')

    const res = await PUT(makeRequest({}), { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('maps priority to Turkish values for DB', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock
      .mockResolvedValueOnce([{ access: 1 }])
      .mockResolvedValueOnce([{ PRIORITY: 'Acil' }])
    executeNonQueryMock.mockResolvedValue({ rowsAffected: 1 })

    const { PUT } = await import('@/app/api/tasks/[id]/route')
    const res = await PUT(makeRequest({ priority: 'urgent' }), { params: makeParams() })

    expect(executeNonQueryMock).toHaveBeenCalledTimes(1)
    const [, params] = executeNonQueryMock.mock.calls[0]
    expect(params.priority_val).toBe('Acil')

    const data = await res.json()
    expect(data.priority).toBe('urgent')
  })

  it('updates completion flag using numeric values', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock
      .mockResolvedValueOnce([{ access: 1 }])
      .mockResolvedValueOnce([{ IS_COMPLETED: 1 }])
    executeNonQueryMock.mockResolvedValue({ rowsAffected: 1 })

    const { PUT } = await import('@/app/api/tasks/[id]/route')
    await PUT(makeRequest({ completed: true }), { params: makeParams() })

    const [, params] = executeNonQueryMock.mock.calls[0]
    expect(params.is_completed_val).toBe(1)
  })

  it('returns 403 when permission check fails', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock.mockResolvedValueOnce([])

    const { PUT } = await import('@/app/api/tasks/[id]/route')
    const res = await PUT(makeRequest({ notes: 'x' }), { params: makeParams() })

    expect(res.status).toBe(403)
  })
})
