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
        const { role, full_name, email } = body

        const updates: string[] = []
        const queryParams: Record<string, any> = { id }

        if (role) {
            if (!['user', 'admin', 'secretary', 'superadmin'].includes(role)) {
                return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
            }
            updates.push('role = :role')
            queryParams.role = role
        }

        if (full_name !== undefined) {
            updates.push('full_name = :full_name')
            queryParams.full_name = full_name
        }

        if (email !== undefined) {
            updates.push('email = :email')
            queryParams.email = email.toLowerCase()
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        // Update user
        const result = await executeNonQuery(
            `UPDATE profiles SET ${updates.join(', ')} WHERE id = :id`,
            queryParams
        )

        return NextResponse.json({ success: true, updated: result })
    } catch (error: any) {
        console.error('Update user error:', error)
        // Don't expose internal error details for security
        return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
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
        // Don't expose internal error details for security
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }
}
