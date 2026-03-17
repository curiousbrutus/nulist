'use client'

import { useState } from 'react'
import { X, Send, Bug, Lightbulb, Palette, MessageCircle } from 'lucide-react'
import { useToastStore } from '@/components/ui/toast'

interface FeedbackModalProps {
    isOpen: boolean
    onClose: () => void
}

const categories = [
    { value: 'bug', label: 'Hata Bildirimi', icon: Bug, color: 'text-red-500' },
    { value: 'feature', label: 'Özellik İsteği', icon: Lightbulb, color: 'text-yellow-500' },
    { value: 'ux', label: 'Kullanım Zorluğu', icon: Palette, color: 'text-purple-500' },
    { value: 'general', label: 'Genel', icon: MessageCircle, color: 'text-blue-500' }
]

const severities = [
    { value: 'low', label: 'Düşük', bg: 'bg-blue-500' },
    { value: 'medium', label: 'Orta', bg: 'bg-yellow-500' },
    { value: 'high', label: 'Yüksek', bg: 'bg-orange-500' },
    { value: 'critical', label: 'Kritik', bg: 'bg-red-500' }
]

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const [category, setCategory] = useState('general')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [severity, setSeverity] = useState('medium')
    const [submitting, setSubmitting] = useState(false)
    const showToast = useToastStore((s) => s.showToast)

    if (!isOpen) return null

    async function handleSubmit() {
        if (!title.trim() || !description.trim()) {
            showToast('Başlık ve açıklama zorunludur', 'error')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    title: title.trim(),
                    description: description.trim(),
                    severity,
                    pageUrl: window.location.href,
                    browserInfo: navigator.userAgent
                })
            })

            if (res.ok) {
                showToast('Geri bildiriminiz alındı. Teşekkürler!', 'success')
                setTitle('')
                setDescription('')
                setCategory('general')
                setSeverity('medium')
                onClose()
            } else {
                const data = await res.json().catch(() => ({}))
                showToast(data.error || 'Gönderilemedi', 'error')
            }
        } catch {
            showToast('Sunucuya ulaşılamadı', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h2 className="text-lg font-bold text-foreground">
                        Geri Bildirim
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Kategori</label>
                        <div className="grid grid-cols-2 gap-2">
                            {categories.map((cat) => {
                                const Icon = cat.icon
                                return (
                                    <button
                                        key={cat.value}
                                        onClick={() => setCategory(cat.value)}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                                            category === cat.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/30'
                                        }`}
                                    >
                                        <Icon className={`h-4 w-4 ${cat.color}`} />
                                        {cat.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Severity */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Önem Derecesi</label>
                        <div className="flex gap-2">
                            {severities.map((sev) => (
                                <button
                                    key={sev.value}
                                    onClick={() => setSeverity(sev.value)}
                                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                        severity === sev.value
                                            ? `${sev.bg} text-white border-transparent shadow-md`
                                            : 'border-border text-muted-foreground hover:border-primary/30'
                                    }`}
                                >
                                    {sev.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Başlık</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Kısa bir açıklama..."
                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                            maxLength={200}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Detaylı Açıklama</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Sorunu veya öneriyi detaylı anlatın..."
                            rows={5}
                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-colors"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !title.trim() || !description.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-xl disabled:opacity-50 transition-colors shadow-md"
                    >
                        <Send className="h-4 w-4" />
                        {submitting ? 'Gönderiliyor...' : 'Gönder'}
                    </button>
                </div>
            </div>
        </div>
    )
}
