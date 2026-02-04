'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { create } from 'zustand'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastState {
    toasts: Toast[]
    showToast: (message: string, type?: ToastType) => void
    removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    showToast: (message, type = 'info') => {
        const id = Math.random().toString(36).substring(2, 9)
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    },
    removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    },
}))

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    const toasts = useToastStore((state) => state.toasts)
    const removeToast = useToastStore((state) => state.removeToast)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return <>{children}</>

    return (
        <>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>
        </>
    )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onRemove(toast.id), 5000)
        return () => clearTimeout(timer)
    }, [toast.id, onRemove])

    const icons = {
        success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
        error: <AlertCircle className="h-4 w-4 text-rose-500" />,
        info: <Info className="h-4 w-4 text-blue-500" />,
    }

    const bgColors = {
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        error: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
    }

    const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ')

    return (
        <div className={cn(
            "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md animate-in slide-in-from-right-full duration-300 min-w-[200px] max-w-sm bg-card/80",
            bgColors[toast.type]
        )}>
            <div className="flex-shrink-0">
                {icons[toast.type]}
            </div>
            <p className="text-sm font-semibold flex-1 text-foreground">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}

export function useToast() {
    return {
        showToast: useToastStore((state) => state.showToast)
    }
}
