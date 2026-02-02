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

const makeGetRequest = (url = 'http://localhost/api/tasks') => {
  const req = new Request(url, { method: 'GET' })
  return req as unknown as NextRequest
}

const makePostRequest = (body: any) => {
  const req = new Request('http://localhost/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return req as unknown as NextRequest
}

describe('GET /api/tasks', () => {
  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue(null)
    const { GET } = await import('@/app/api/tasks/route')
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns tasks list', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock.mockResolvedValue([{ id: 't1' }])

    const { GET } = await import('@/app/api/tasks/route')
    const res = await GET(makeGetRequest())

    const data = await res.json()
    expect(data).toEqual([{ id: 't1' }])
  })
})

describe('POST /api/tasks', () => {
  it('validates required fields', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    const { POST } = await import('@/app/api/tasks/route')

    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })

  it('creates a task and returns it', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeNonQueryMock.mockResolvedValue({ rowsAffected: 1 })
    executeQueryMock.mockResolvedValue([{ id: 't1', priority: 'Acil' }])

    const { POST } = await import('@/app/api/tasks/route')
    const res = await POST(makePostRequest({
      title: 'New Task',
      list_id: 'list_1',
      priority: 'urgent'
    }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('t1')
  })
})
