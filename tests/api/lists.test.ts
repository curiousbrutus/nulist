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

const makeGetRequest = (url = 'http://localhost/api/lists') => new Request(url, { method: 'GET' }) as unknown as NextRequest
const makePostRequest = (body: any) => new Request('http://localhost/api/lists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}) as unknown as NextRequest

describe('GET /api/lists', () => {
  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue(null)
    const { GET } = await import('@/app/api/lists/route')
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns lists list', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock.mockResolvedValue([{ id: 'l1' }])

    const { GET } = await import('@/app/api/lists/route')
    const res = await GET(makeGetRequest('http://localhost/api/lists?folder_id=f1'))
    const data = await res.json()

    expect(data).toEqual([{ id: 'l1' }])
  })
})

describe('POST /api/lists', () => {
  it('validates required title', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    const { POST } = await import('@/app/api/lists/route')

    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })
})
