'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, X, Sparkles, Image as ImageIcon, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToastStore } from '@/components/ui/toast'

interface AIAssistantProps {
    listId?: string
}

interface Message {
    role: 'user' | 'assistant'
    content: string
    images?: string[]
}

export default function AIAssistant({ listId }: AIAssistantProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [images, setImages] = useState<string[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const showToast = useToastStore((state) => state.showToast)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        const userImages = [...images]
        setInput('')
        setImages([])
        setMessages(prev => [...prev, { role: 'user', content: userMessage, images: userImages }])
        setIsLoading(true)

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    context: listId ? { list_id: listId } : undefined,
                    images: userImages.length > 0 ? userImages : undefined
                })
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('AI API Error:', data)
                const errorMsg = data.details || data.error || 'AI yanıt veremedi'
                throw new Error(errorMsg)
            }

            setMessages(prev => [...prev, { role: 'assistant', content: data.message }])

        } catch (error: any) {
            console.error('AI error:', error)
            const errorMessage = error.message || 'AI asistan yanıt veremedi'
            showToast(errorMessage.substring(0, 100), 'error')
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: 'Üzgünüm, şu anda yanıt veremiyorum. Lütfen daha sonra tekrar deneyin.' 
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                showToast('Sadece resim dosyaları yüklenebilir', 'error')
                return
            }

            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showToast('Dosya boyutu 5MB\'dan küçük olmalı', 'error')
                return
            }

            const reader = new FileReader()
            reader.onload = (e) => {
                const base64 = e.target?.result as string
                setImages(prev => [...prev, base64])
            }
            reader.readAsDataURL(file)
        })
    }

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 z-50"
                title="AI Asistan"
            >
                <Sparkles className="h-6 w-6" />
            </Button>
        )
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-card border rounded-2xl shadow-2xl flex flex-col z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">AI Asistan</h3>
                        <p className="text-xs text-muted-foreground">128K context • OCR • Charts</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 p-0"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center py-12 space-y-3">
                        <div className="text-4xl">🚀</div>
                        <p className="text-sm text-muted-foreground">
                            NVIDIA Nemotron 2 VL - 128K context!<br/>
                            Görevlerinizi analiz eder, belgelerinizi okur, grafiklerinizi yorumlarım!
                        </p>
                        <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mx-4">
                            <strong>Not:</strong> Sadece görüntüleme ve analiz yapabilirim. Görev değiştirme yetkim yok.
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center pt-2">
                            <button
                                onClick={() => setInput('Bana atanan görevlerimi göster')}
                                className="text-xs bg-blue-500/10 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-500/20"
                            >
                                📋 Görevlerim
                            </button>
                            <button
                                onClick={() => setInput('Öncelikli görevlerimi analiz et')}
                                className="text-xs bg-purple-500/10 text-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-500/20"
                            >
                                ⚡ Öncelikli görevler
                            </button>
                            <button
                                onClick={() => setInput('Yaklaşan bitiş tarihli görevlerim var mı?')}
                                className="text-xs bg-pink-500/10 text-pink-600 px-3 py-1.5 rounded-full hover:bg-pink-500/20"
                            >
                                ⏰ Yaklaşan görevler
                            </button>
                            <button
                                onClick={() => {
                                    fileInputRef.current?.click()
                                    showToast('Grafik, tablo veya belge yükleyin! 📊', 'success')
                                }}
                                className="text-xs bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full hover:bg-green-500/20"
                            >
                                📊 OCR/Chart Analizi
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                            msg.role === 'user' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                        }`}>
                            {msg.role === 'user' ? '👤' : <Bot className="h-4 w-4" />}
                        </div>
                        <div className={`flex-1 rounded-2xl p-3 text-sm ${
                            msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                        }`}>
                            {msg.images && msg.images.length > 0 && (
                                <div className="flex gap-2 mb-2 flex-wrap">
                                    {msg.images.map((img, idx) => (
                                        <img 
                                            key={idx} 
                                            src={img} 
                                            alt={`Upload ${idx + 1}`}
                                            className="max-w-[200px] max-h-[150px] rounded-lg border"
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 rounded-2xl p-3 bg-muted">
                            <div className="flex gap-1">
                                <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                />
                
                {images.length > 0 && (
                    <div className="mb-2 flex gap-2 flex-wrap">
                        {images.map((img, idx) => (
                            <div key={idx} className="relative group">
                                <img 
                                    src={img} 
                                    alt={`Preview ${idx + 1}`}
                                    className="w-16 h-16 rounded-lg border object-cover"
                                />
                                <button
                                    onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        variant="outline"
                        className="h-10 w-10 p-0"
                        title="Görsel/Belge yükle (OCR, Chart, Grafik analizi)"
                    >
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Bir soru sorun..."
                        className="flex-1 bg-muted border-none rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={isLoading}
                    />
                    <Button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className="h-10 w-10 p-0 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    🚀 NVIDIA Nemotron 2 VL - OCR, Chart & Doc Analysis
                </p>
            </div>
        </div>
    )
}
