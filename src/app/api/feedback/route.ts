import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

// GET /api/feedback — list feedback (admin: all, user: own)
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const profile = await executeQuery(
            `SELECT role FROM profiles WHERE id = :uid`,
            { uid: session.user.id },
            session.user.id
        )
        const role = (profile?.[0] as any)?.ROLE || (profile?.[0] as any)?.role || 'user'
        const isPrivileged = ['superadmin', 'admin'].includes(role)

        let rows
        if (isPrivileged) {
            rows = await executeQuery(
                `SELECT f.id, f.user_id, f.category, f.title, f.description,
                        f.severity, f.status, f.page_url, f.created_at, f.agent_notes,
                        p.full_name as user_name, p.email as user_email
                 FROM user_feedback f
                 LEFT JOIN profiles p ON p.id = f.user_id
                 ORDER BY f.created_at DESC
                 FETCH FIRST 100 ROWS ONLY`,
                {},
                session.user.id
            )
        } else {
            rows = await executeQuery(
                `SELECT id, user_id, category, title, description,
                        severity, status, page_url, created_at, agent_notes
                 FROM user_feedback
                 WHERE user_id = :uid
                 ORDER BY created_at DESC
                 FETCH FIRST 50 ROWS ONLY`,
                { uid: session.user.id },
                session.user.id
            )
        }

        return NextResponse.json(rows || [])
    } catch (error: any) {
        console.error('[feedback GET]', error)
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
    }
}

// POST /api/feedback — submit feedback
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { category, title, description, severity, pageUrl, browserInfo } = body

        if (!title?.trim() || !description?.trim()) {
            return NextResponse.json({ error: 'Başlık ve açıklama zorunludur' }, { status: 400 })
        }

        const id = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await executeNonQuery(
            `INSERT INTO user_feedback (id, user_id, category, title, description, severity, page_url, browser_info)
             VALUES (:id, :userId, :category, :title, :description, :severity, :pageUrl, :browserInfo)`,
            {
                id,
                userId: session.user.id,
                category: category || 'general',
                title: title.trim().substring(0, 200),
                description: description.trim(),
                severity: severity || 'medium',
                pageUrl: (pageUrl || '').substring(0, 500),
                browserInfo: (browserInfo || '').substring(0, 500)
            },
            session.user.id
        )

        return NextResponse.json({ id, success: true }, { status: 201 })
    } catch (error: any) {
        console.error('[feedback POST]', error)
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
    }
}
