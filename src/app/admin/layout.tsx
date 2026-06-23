import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export default async function AdminLayout({
    children,
}: {
    children: ReactNode
}) {
    const session = await auth()

    if (!session?.user?.email) {
        redirect('/login')
    }

    // Rolü JWT yerine DB'den oku: rol değişikliği (örn. superadmin yapılma) aktif
    // oturumun token'ına yansımadığı için JWT bayatlayabilir. DB her zaman günceldir.
    const userId = (session.user as any)?.id as string | undefined
    const rows = await executeQuery(
        userId ? `SELECT role FROM profiles WHERE id = :id` : `SELECT role FROM profiles WHERE email = :email`,
        userId ? { id: userId } : { email: session.user.email }
    )
    const role = String(rows[0]?.role || rows[0]?.ROLE || '')
    if (role !== 'admin' && role !== 'superadmin') {
        redirect('/')
    }

    return <>{children}</>
}
