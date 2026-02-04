import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { auth } from '@/auth'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check superadmin role for updates
        const adminProfile = await executeQuery(
            `SELECT role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        if (!adminProfile?.[0] || adminProfile[0].role !== 'superadmin') {
            return NextResponse.json({ error: 'Only superadmin can update roles' }, { status: 403 })
        }

        const body = await request.json()
        const { role } = body

        if (!['user', 'admin', 'secretary', 'superadmin'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        // Update user role
        const result = await executeNonQuery(
            `UPDATE profiles SET role = :role WHERE id = :id`,
            { role, id }
        )

        return NextResponse.json({ success: true, updated: result })
    } catch (error: any) {
        console.error('Update user error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check superadmin role for deletion
        const adminProfile = await executeQuery(
            `SELECT role FROM profiles WHERE email = :email`,
            { email: session.user.email }
        )

        if (!adminProfile?.[0] || (adminProfile[0].role !== 'superadmin' && adminProfile[0].role !== 'admin')) {
            return NextResponse.json({ error: 'Only admin/superadmin can delete users' }, { status: 403 })
        }

        // Delete user and related data
        await executeNonQuery(
            `DELETE FROM task_assignees WHERE user_id = :id`,
            { id }
        )

        await executeNonQuery(
            `DELETE FROM profiles WHERE id = :id`,
            { id }
        )

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Delete user error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
