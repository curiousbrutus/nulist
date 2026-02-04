import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.fn()
const executeQueryMock = vi.fn()

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/oracle', () => ({ executeQuery: executeQueryMock }))

const makeRequest = (format: 'csv' | 'xlsx') => {
  const req = new Request(`http://localhost/api/tasks/export?list_id=list_1&format=${format}`, {
    method: 'GET'
  })
  return req as unknown as NextRequest
}

describe('GET /api/tasks/export', () => {
  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue(null)
    const { GET } = await import('@/app/api/tasks/export/route')
    const res = await GET(makeRequest('csv'))
    expect(res.status).toBe(401)
  })

  it('returns CSV with correct content type', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock
      .mockResolvedValueOnce([{ NAME: 'List' }])
      .mockResolvedValueOnce([
        { TITLE: 'Görev', NOTES: 'Not', PRIORITY: 'Orta', IS_COMPLETED: 0 }
      ])

    const { GET } = await import('@/app/api/tasks/export/route')
    const res = await GET(makeRequest('csv'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
  })

  it('returns XLSX with correct content type', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock
      .mockResolvedValueOnce([{ NAME: 'List' }])
      .mockResolvedValueOnce([
        { TITLE: 'Görev', NOTES: 'Not', PRIORITY: 'Orta', IS_COMPLETED: 0 }
      ])

    const { GET } = await import('@/app/api/tasks/export/route')
    const res = await GET(makeRequest('xlsx'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })
})
