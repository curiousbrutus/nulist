'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, X } from 'lucide-react'
import { Button } from './button'

interface ConfirmDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Sil',
    cancelText = 'Vazgeç',
    variant = 'danger'
}: ConfirmDialogProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
                    />

                    {/* Dialog */}
                    <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-sm bg-card border shadow-2xl rounded-2xl overflow-hidden pointer-events-auto"
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`p-3 rounded-xl ${variant === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                        <AlertCircle className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                                </div>

                                <p className="text-muted-foreground leading-relaxed">
                                    {description}
                                </p>
                            </div>

                            <div className="p-4 bg-muted/30 border-t flex items-center gap-2 justify-end">
                                <Button variant="ghost" onClick={onClose} className="rounded-xl">
                                    {cancelText}
                                </Button>
                                <Button
                                    variant={variant === 'danger' ? 'destructive' : 'primary'}
                                    onClick={() => {
                                        onConfirm()
                                        onClose()
                                    }}
                                    className="rounded-xl px-6"
                                >
                                    {confirmText}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
