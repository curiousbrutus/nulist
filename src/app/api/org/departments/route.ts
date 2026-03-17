import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const facilityId = (searchParams.get('facility_id') || '').trim()
        const includeInactive = searchParams.get('include_inactive') === '1'

        const whereParts: string[] = []
        const params: Record<string, string | number> = {}

        if (facilityId) {
            whereParts.push('d.facility_id = :facility_id')
            params.facility_id = facilityId
        }

        if (!includeInactive) {
            whereParts.push('d.is_active = 1')
        }

        const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

        const departments = await executeQuery(
            `SELECT d.id,
                    d.name,
                    d.category,
                    d.facility_id,
                    d.parent_id,
                    d.is_active,
                    f.name AS facility_name
             FROM departments d
             JOIN facilities f ON f.id = d.facility_id
             ${whereSql}
             ORDER BY f.name ASC, d.name ASC`,
            params,
            session.user.id
        )

        return NextResponse.json(departments)
    } catch (error: any) {
        console.error('GET /api/org/departments error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
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
        const facilityId = typeof body.facility_id === 'string' ? body.facility_id.trim() : ''
        const category = typeof body.category === 'string' ? body.category.trim() : null
        const parentId = typeof body.parent_id === 'string' && body.parent_id.trim() ? body.parent_id.trim() : null

        if (!name || !facilityId) {
            return NextResponse.json({ error: 'Department name and facility_id are required' }, { status: 400 })
        }

        const facilityRows = await executeQuery(
            `SELECT id FROM facilities WHERE id = :id AND is_active = 1`,
            { id: facilityId },
            session.user.id
        )

        if (facilityRows.length === 0) {
            return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
        }

        if (parentId) {
            const parentRows = await executeQuery(
                `SELECT id FROM departments WHERE id = :id`,
                { id: parentId },
                session.user.id
            )
            if (parentRows.length === 0) {
                return NextResponse.json({ error: 'Parent department not found' }, { status: 404 })
            }
        }

        const id = randomUUID()

        await executeNonQuery(
            `INSERT INTO departments (id, facility_id, parent_id, name, category, is_active)
             VALUES (:id, :facility_id, :parent_id, :name, :category, 1)`,
            {
                id,
                facility_id: facilityId,
                parent_id: parentId,
                name,
                category
            },
            session.user.id
        )

        const rows = await executeQuery(
            `SELECT d.id,
                    d.name,
                    d.category,
                    d.facility_id,
                    d.parent_id,
                    d.is_active,
                    f.name AS facility_name
             FROM departments d
             JOIN facilities f ON f.id = d.facility_id
             WHERE d.id = :id`,
            { id },
            session.user.id
        )

        return NextResponse.json(rows[0], { status: 201 })
    } catch (error: any) {
        console.error('POST /api/org/departments error:', error)
        if (error?.errorNum === 1) {
            return NextResponse.json({ error: 'Department already exists in selected facility' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
