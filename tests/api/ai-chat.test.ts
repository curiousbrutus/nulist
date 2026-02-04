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
  it('returns 503 when API key missing', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    const original = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = ''

    const { POST } = await import('@/app/api/ai/chat/route')
    const res = await POST(makeRequest({ message: 'test' }))

    expect(res.status).toBe(503)
    process.env.OPENROUTER_API_KEY = original
  })

  it('returns AI message when OpenRouter responds', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock.mockResolvedValue([])

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Merhaba' } }]
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
