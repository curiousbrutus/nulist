import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeNonQuery, executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        // Standard Template
        const template = [
            {
                department: "Tıbbi Hizmetler",
                units: ["Hemşirelik Hizmetleri", "Acil Servis", "Ameliyathane", "Yoğun Bakım"]
            },
            {
                department: "İdari Hizmetler",
                units: ["İnsan Kaynakları", "Bilgi İşlem", "Muhasebe", "Satın Alma"]
            },
            {
                department: "Kalite Yönetimi",
                units: ["Hasta Deneyimi", "Süreç İyileştirme", "Risk Yönetimi"]
            },
            {
                department: "Pazarlama & İş Geliştirme",
                units: ["Kurumsal İletişim", "Sağlık Turizmi", "Dijital Pazarlama"]
            }
        ]

        for (const item of template) {
            const deptId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`

            // 1. Create Department
            await executeNonQuery(
                `INSERT INTO folders (id, title, user_id, parent_id) VALUES (:id, :title, :user_id, NULL)`,
                { id: deptId, title: item.department, user_id: userId },
                userId
            )

            // 2. Add as member
            await executeNonQuery(
                `INSERT INTO folder_members (id, folder_id, user_id, role) VALUES (:id, :fid, :uid, 'admin')`,
                { id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, fid: deptId, uid: userId },
                userId
            )

            // 3. Create Units
            for (const unit of item.units) {
                const unitId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                await executeNonQuery(
                    `INSERT INTO folders (id, title, user_id, parent_id) VALUES (:id, :title, :user_id, :pid)`,
                    { id: unitId, title: unit, user_id: userId, pid: deptId },
                    userId
                )
                await executeNonQuery(
                    `INSERT INTO folder_members (id, folder_id, user_id, role) VALUES (:id, :fid, :uid, 'admin')`,
                    { id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, fid: unitId, uid: userId },
                    userId
                )
            }
        }

        return NextResponse.json({ success: true, message: 'Template applied successfully' })

    } catch (error: any) {
        console.error('Setup Template error:', error)
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
    }
}
