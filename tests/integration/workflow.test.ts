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

const makePost = (body: any) => new Request('http://localhost/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}) as unknown as NextRequest

const makePut = (body: any) => new Request('http://localhost/api/tasks/task_1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}) as unknown as NextRequest

const makeParams = async () => ({ id: 'task_1' })

describe('Workflow: create then update task', () => {
  it('creates a task then updates priority', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })

    executeNonQueryMock.mockResolvedValue({ rowsAffected: 1 })
    executeQueryMock
      .mockResolvedValueOnce([{ id: 'task_1', priority: 'Orta' }]) // POST select
      .mockResolvedValueOnce([{ access: 1 }]) // PUT permission
      .mockResolvedValueOnce([{ PRIORITY: 'Acil' }]) // PUT select

    const { POST } = await import('@/app/api/tasks/route')
    const { PUT } = await import('@/app/api/tasks/[id]/route')

    const createRes = await POST(makePost({ title: 'A', list_id: 'list_1' }))
    expect(createRes.status).toBe(201)

    const updateRes = await PUT(makePut({ priority: 'urgent' }), { params: makeParams() })
    const updated = await updateRes.json()
    expect(updated.priority).toBe('urgent')
  })
})
