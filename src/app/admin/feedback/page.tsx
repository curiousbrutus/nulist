'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, Bug, Lightbulb, Palette, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Feedback {
    ID: string
    USER_NAME?: string
    USER_EMAIL?: string
    CATEGORY: string
    TITLE: string
    DESCRIPTION: string
    SEVERITY: string
    STATUS: string
    PAGE_URL?: string
    CREATED_AT: string
}

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
    bug: { label: 'Hata', icon: Bug, color: 'text-red-500' },
    feature: { label: 'Özellik', icon: Lightbulb, color: 'text-yellow-500' },
    ux: { label: 'UX', icon: Palette, color: 'text-purple-500' },
    general: { label: 'Genel', icon: MessageCircle, color: 'text-blue-500' }
}

const severityColors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

const statusLabels: Record<string, string> = {
    open: 'Açık',
    in_progress: 'İşleniyor',
    resolved: 'Çözüldü',
    closed: 'Kapatıldı'
}

export default function AdminFeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    const fetchFeedbacks = () => {
        setLoading(true)
        fetch('/api/feedback')
            .then((r) => r.json())
            .then((data) => {
                setFeedbacks(Array.isArray(data) ? data : [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }

    useEffect(() => {
        fetchFeedbacks()
    }, [])

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 text-foreground">
            <div className="max-w-5xl mx-auto space-y-6">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">Kullanıcı Geri Bildirimleri</h1>
                            <p className="text-sm text-muted-foreground">{feedbacks.length} geri bildirim</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchFeedbacks} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Yenile
                    </Button>
                </header>

                {loading && feedbacks.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : feedbacks.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        Henüz geri bildirim yok
                    </div>
                ) : (
                    <div className="space-y-3">
                        {feedbacks.map((fb) => {
                            const cat = categoryConfig[fb.CATEGORY] || categoryConfig.general
                            const CatIcon = cat.icon
                            return (
                                <div key={fb.ID} className="bg-card border border-border rounded-2xl p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <CatIcon className={`h-4 w-4 ${cat.color}`} />
                                                <span className="text-xs text-muted-foreground">{cat.label}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[fb.SEVERITY] || ''}`}>
                                                    {fb.SEVERITY}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                                                    {statusLabels[fb.STATUS] || fb.STATUS}
                                                </span>
                                            </div>
                                            <h3 className="font-semibold text-foreground">{fb.TITLE}</h3>
                                            <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">
                                                {fb.DESCRIPTION}
                                            </p>
                                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                                <span>{fb.USER_NAME || fb.USER_EMAIL || 'Bilinmeyen'}</span>
                                                <span>{new Date(fb.CREATED_AT).toLocaleString('tr-TR')}</span>
                                                {fb.PAGE_URL && (
                                                    <span className="truncate max-w-[200px]" title={fb.PAGE_URL}>{fb.PAGE_URL}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
