'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Admin route error boundary:', error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0e27] dark:to-[#111736] p-6">
            <div className="max-w-xl w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin ekranında bir hata oluştu</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Sayfa yüklenirken beklenmeyen bir istemci hatası oluştu. Tekrar denemek için aşağıdaki butonu kullanın.
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
                    {error?.message || 'Unknown admin route error'}
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => reset()} className="bg-blue-600 hover:bg-blue-700 text-white">
                        Tekrar Dene
                    </Button>
                    <Button variant="outline" onClick={() => window.location.href = '/'}>
                        Ana Sayfaya Dön
                    </Button>
                </div>
            </div>
        </div>
    )
}
