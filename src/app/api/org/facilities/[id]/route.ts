import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeNonQuery, executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

async function ensureAdmin(userId: string) {
    const roleRows = await executeQuery(
        `SELECT role FROM profiles WHERE id = :id`,
        { id: userId },
        userId
    )
    const role = roleRows[0]?.role || roleRows[0]?.ROLE
    return role === 'admin' || role === 'superadmin'
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await ensureAdmin(session.user.id))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()

        const updates: string[] = []
        const queryParams: Record<string, any> = { id }

        if (typeof body.name === 'string') {
            const name = body.name.trim()
            if (!name) return NextResponse.json({ error: 'Facility name is required' }, { status: 400 })
            updates.push('name = :name')
            queryParams.name = name
        }

        if (typeof body.code === 'string') {
            updates.push('code = :code')
            queryParams.code = body.code.trim().toUpperCase()
        }

        if (typeof body.timezone === 'string') {
            updates.push('timezone = :timezone')
            queryParams.timezone = body.timezone.trim() || 'Europe/Istanbul'
        }

        if (body.address !== undefined) {
            updates.push('address = :address')
            queryParams.address = typeof body.address === 'string' ? body.address.trim() : null
        }

        if (body.is_active !== undefined) {
            updates.push('is_active = :is_active')
            queryParams.is_active = body.is_active ? 1 : 0
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        updates.push('updated_at = SYSTIMESTAMP')

        const result = await executeNonQuery(
            `UPDATE facilities SET ${updates.join(', ')} WHERE id = :id`,
            queryParams,
            session.user.id
        )

        if (!result?.rowsAffected) {
            return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
        }

        const rows = await executeQuery(
            `SELECT id, code, name, timezone, address, is_active FROM facilities WHERE id = :id`,
            { id },
            session.user.id
        )

        return NextResponse.json(rows[0])
    } catch (error: any) {
        console.error('PUT /api/org/facilities/[id] error:', error)
        if (error?.errorNum === 1) {
            return NextResponse.json({ error: 'Facility already exists' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await ensureAdmin(session.user.id))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params

        await executeNonQuery(
            `UPDATE facilities
             SET is_active = 0,
                 updated_at = SYSTIMESTAMP
             WHERE id = :id`,
            { id },
            session.user.id
        )

        await executeNonQuery(
            `UPDATE departments
             SET is_active = 0,
                 updated_at = SYSTIMESTAMP
             WHERE facility_id = :id`,
            { id },
            session.user.id
        )

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('DELETE /api/org/facilities/[id] error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
