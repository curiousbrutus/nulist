import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function AdminLayout({
    children,
}: {
    children: ReactNode
}) {
    const session = await auth()

    if (!session?.user?.email) {
        redirect('/login')
    }

    const role = String((session.user as any)?.role || '')
    if (role !== 'admin' && role !== 'superadmin') {
        redirect('/')
    }

    return <>{children}</>
}
