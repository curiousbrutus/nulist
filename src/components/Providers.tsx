'use client'

import { useEffect, useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import AuthListener from '@/components/layout/AuthListener'
import { ToastProvider } from '@/components/ui/toast'
import FeedbackModal from '@/components/feedback/FeedbackModal'
import { MessageSquarePlus } from 'lucide-react'

export default function Providers({ children }: { children: React.ReactNode }) {
    const [feedbackOpen, setFeedbackOpen] = useState(false)
    useEffect(() => {
        const reloadKey = '__neolist_chunk_reload_once__'

        const shouldRecoverFromError = (message: string) => {
            const text = (message || '').toLowerCase()
            return (
                text.includes('chunkloaderror') ||
                text.includes('loading chunk') ||
                text.includes('failed to fetch dynamically imported module') ||
                text.includes('css_chunk_load_failed') ||
                text.includes('loading css chunk') ||
                text.includes('unexpected token')
            )
        }

        const recover = () => {
            const alreadyReloaded = sessionStorage.getItem(reloadKey) === '1'
            if (alreadyReloaded) return
            sessionStorage.setItem(reloadKey, '1')
            window.location.reload()
        }

        const onError = (event: ErrorEvent) => {
            const msg = String(event?.message || event?.error?.message || '')
            if (shouldRecoverFromError(msg)) {
                recover()
            }
        }

        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event?.reason
            const msg = String(reason?.message || reason || '')
            if (shouldRecoverFromError(msg)) {
                recover()
            }
        }

        window.addEventListener('error', onError)
        window.addEventListener('unhandledrejection', onUnhandledRejection)

        const clearTimer = window.setTimeout(() => {
            sessionStorage.removeItem(reloadKey)
        }, 15000)

        return () => {
            window.removeEventListener('error', onError)
            window.removeEventListener('unhandledrejection', onUnhandledRejection)
            window.clearTimeout(clearTimer)
        }
    }, [])

    return (
        <SessionProvider>
            <ToastProvider>
                <AuthListener />
                {children}
                <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
                <button
                    onClick={() => setFeedbackOpen(true)}
                    className="fixed bottom-20 right-6 z-[9990] w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                    title="Geri Bildirim"
                >
                    <MessageSquarePlus className="h-5 w-5" />
                </button>
            </ToastProvider>
        </SessionProvider>
    )
}
