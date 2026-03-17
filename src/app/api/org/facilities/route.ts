import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeNonQuery, executeQuery } from '@/lib/oracle'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

async function getCurrentRole(userId: string) {
    const roleRows = await executeQuery(
        `SELECT role FROM profiles WHERE id = :id`,
        { id: userId },
        userId
    )
    return roleRows[0]?.role || roleRows[0]?.ROLE
}

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get('include_inactive') === '1'

        const facilities = await executeQuery(
            `SELECT id, code, name, timezone, address, is_active
             FROM facilities
             WHERE (:include_inactive = 1 OR is_active = 1)
             ORDER BY name ASC`,
            { include_inactive: includeInactive ? 1 : 0 },
            session.user.id
        )

        return NextResponse.json(facilities)
    } catch (error: any) {
        console.error('GET /api/org/facilities error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const role = await getCurrentRole(session.user.id)
        if (role !== 'admin' && role !== 'superadmin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : name.toUpperCase().replace(/\s+/g, '_')
        const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'Europe/Istanbul'
        const address = typeof body.address === 'string' ? body.address.trim() : null

        if (!name) {
            return NextResponse.json({ error: 'Facility name is required' }, { status: 400 })
        }

        const id = randomUUID()

        await executeNonQuery(
            `INSERT INTO facilities (id, code, name, timezone, address, is_active)
             VALUES (:id, :code, :name, :timezone, :address, 1)`,
            {
                id,
                code,
                name,
                timezone,
                address
            },
            session.user.id
        )

        const facilityRows = await executeQuery(
            `SELECT id, code, name, timezone, address, is_active
             FROM facilities
             WHERE id = :id`,
            { id },
            session.user.id
        )

        return NextResponse.json(facilityRows[0], { status: 201 })
    } catch (error: any) {
        console.error('POST /api/org/facilities error:', error)
        if (error?.errorNum === 1) {
            return NextResponse.json({ error: 'Facility already exists' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
