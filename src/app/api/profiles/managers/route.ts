import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const currentProfile = await executeQuery(
            `SELECT role, branch FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )

        if (!currentProfile?.length) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        const role = currentProfile[0].role || currentProfile[0].ROLE
        const branch = currentProfile[0].branch || currentProfile[0].BRANCH
        const isAllBranches = branch === 'Tüm Şubeler' || branch === 'TUM_SUBELER' || branch === 'ALL'
        const { searchParams } = new URL(request.url)
        const query = (searchParams.get('q') || '').trim().toLowerCase()

        const whereParts: string[] = ['p.id != :current_user_id']
        const params: Record<string, any> = {
            current_user_id: session.user.id
        }

        // Tüm kullanıcılar tüm şubelerden yönetici/sorumlu seçebilir
        // (Birim yöneticileri diğer şubelerdeki üstlerini seçebilmeli)

        if (query.length > 0) {
            whereParts.push('(LOWER(p.full_name) LIKE :q OR LOWER(p.email) LIKE :q)')
            params.q = `%${query}%`
        }

        const managers = await executeQuery(
            `SELECT p.id, p.full_name, p.email, p.department, p.branch, p.role
             FROM profiles p
             WHERE ${whereParts.join(' AND ')}
             ORDER BY p.full_name ASC`,
            params
        )

        return NextResponse.json(managers)
    } catch (error: any) {
        console.error('GET /api/profiles/managers error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
