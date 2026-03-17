import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.fn()
const executeQueryMock = vi.fn()

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/oracle', () => ({ executeQuery: executeQueryMock }))

const makeRequest = (body: any) => {
  const req = new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return req as unknown as NextRequest
}

describe('POST /api/ai/chat', () => {
  it('returns 503 when Ollama is unreachable', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock.mockResolvedValue([])

    const fetchMock = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/ai/chat/route')
    const res = await POST(makeRequest({ message: 'test' }))

    expect(res.status).toBe(503)
  })

  it('returns AI message when Ollama responds', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock.mockResolvedValue([])

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Merhaba' },
        model: 'qwen2.5:3b'
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/ai/chat/route')
    const res = await POST(makeRequest({ message: 'Merhaba' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.message).toBe('Merhaba')
  })
})
