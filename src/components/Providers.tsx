'use client'

import { SessionProvider } from 'next-auth/react'
import AuthListener from '@/components/layout/AuthListener'
import { ToastProvider } from '@/components/ui/toast'

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ToastProvider>
                <AuthListener />
                {children}
            </ToastProvider>
        </SessionProvider>
    )
}
