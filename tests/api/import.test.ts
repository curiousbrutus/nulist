import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

const authMock = vi.fn()
const executeQueryMock = vi.fn()
const executeNonQueryMock = vi.fn()

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/oracle', () => ({
  executeQuery: executeQueryMock,
  executeNonQuery: executeNonQueryMock
}))

const makeFormRequest = async (file?: File, listId?: string) => {
  const form = new FormData()
  if (file) form.append('file', file)
  if (listId) form.append('list_id', listId)

  const req = new Request('http://localhost/api/tasks/import', {
    method: 'POST',
    body: form
  })

  return req as unknown as NextRequest
}

describe('POST /api/tasks/import', () => {
  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/tasks/import/route')

    const res = await POST(await makeFormRequest())
    expect(res.status).toBe(401)
  })

  it('returns 400 when file missing', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    const { POST } = await import('@/app/api/tasks/import/route')

    const res = await POST(await makeFormRequest(undefined, 'list_1'))
    expect(res.status).toBe(400)
  })

  it('imports tasks from XLSX', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    executeQueryMock.mockResolvedValue([{ ID: 'u2', FULL_NAME: 'Ali Veli', NAME_LOWER: 'ali veli' }])
    executeNonQueryMock.mockResolvedValue({ rowsAffected: 1 })

    const sheet = XLSX.utils.json_to_sheet([
      { 'Görev Adı': 'Test Görevi', 'Açıklama': 'Not', 'Öncelik': 'Orta' }
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const file = new File([buffer], 'tasks.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const { POST } = await import('@/app/api/tasks/import/route')
    const res = await POST(await makeFormRequest(file, 'list_1'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.imported).toBeGreaterThan(0)
  })
})
