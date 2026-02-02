'use client'

import { useState } from 'react'
import { Download, Trash2, FileText, Loader2, ExternalLink, CheckSquare, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { TaskAttachment } from '@/types/database'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface AttachmentListProps {
    attachments: TaskAttachment[]
    onDelete: (attachmentId: string) => Promise<void>
    onBatchDelete?: (ids: string[]) => Promise<void>
    canDelete: boolean
    currentUserId?: string
}

export default function AttachmentList({ attachments, onDelete, onBatchDelete, canDelete, currentUserId }: AttachmentListProps) {
    const [deletingIds, setDeletingIds] = useState<string[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[]>([])
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
    const [isDeletingAll, setIsDeletingAll] = useState(false)
    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const { showToast } = useToast()

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    const getFileIcon = (type: string | null | undefined): string => {
        if (!type) return '📎'
        if (type.startsWith('image/')) return '🖼️'
        if (type.includes('pdf')) return '📄'
        if (type.includes('word') || type.includes('document')) return '📝'
        if (type.includes('excel') || type.includes('spreadsheet')) return '📊'
        if (type.includes('zip') || type.includes('rar')) return '📦'
        if (type.includes('text')) return '📃'
        return '📎'
    }

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const handleView = (attachment: TaskAttachment) => {
        window.open(`/api/attachments/${attachment.id}`, '_blank')
    }

    const handleDownload = async (attachment: TaskAttachment) => {
        try {
            const response = await fetch(`/api/attachments/${attachment.id}`)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = attachment.file_name
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            showToast('Dosya indirilemedi', 'error')
        }
    }

    const handleDeleteSingle = async (attachmentId: string) => {
        setDeletingIds(prev => [...prev, attachmentId])
        try {
            await onDelete(attachmentId)
            showToast('Dosya silindi', 'success')
            setSelectedIds(prev => prev.filter(id => id !== attachmentId))
        } catch (error) {
            showToast('Dosya silinemedi', 'error')
        } finally {
            setDeletingIds(prev => prev.filter(id => id !== attachmentId))
            setConfirmDeleteIds([])
        }
    }

    const handleDeleteMultiple = async () => {
        const idsToDelete = confirmDeleteIds
        setDeletingIds(prev => [...prev, ...idsToDelete])

        // Paralel silme için Promise.all kullan
        const results = await Promise.allSettled(
            idsToDelete.map(id => onDelete(id))
        )

        const successCount = results.filter(r => r.status === 'fulfilled').length

        setDeletingIds(prev => prev.filter(id => !idsToDelete.includes(id)))
        setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)))
        setConfirmDeleteIds([])

        if (successCount > 0) {
            showToast(`${successCount} dosya silindi`, 'success')
        }

        if (selectedIds.length === idsToDelete.length) {
            setIsSelectionMode(false)
        }
    }

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        )
    }

    const selectAll = () => {
        const deletableIds = attachments
            .filter(a => canDeleteAttachment(a))
            .map(a => a.id)
        setSelectedIds(deletableIds)
    }

    const deselectAll = () => {
        setSelectedIds([])
    }

    const canDeleteAttachment = (attachment: TaskAttachment): boolean => {
        if (attachment.user_id === currentUserId) return true
        return canDelete
    }

    const deletableAttachments = attachments.filter(a => canDeleteAttachment(a))
    const allDeletableSelected = deletableAttachments.length > 0 &&
        deletableAttachments.every(a => selectedIds.includes(a.id))

    // Tümünü Sil fonksiyonu
    const handleDeleteAll = async () => {
        const allIds = deletableAttachments.map(a => a.id)
        if (allIds.length === 0) return

        setIsDeletingAll(true)
        setDeletingIds(allIds)

        try {
            if (onBatchDelete) {
                // Batch API kullan
                await onBatchDelete(allIds)
            } else {
                // Fallback: Paralel silme
                await Promise.allSettled(allIds.map(id => onDelete(id)))
            }
            showToast(`${allIds.length} dosya silindi`, 'success')
        } catch (error) {
            showToast('Dosyalar silinemedi', 'error')
        } finally {
            setIsDeletingAll(false)
            setDeletingIds([])
            setConfirmDeleteAll(false)
            setSelectedIds([])
            setIsSelectionMode(false)
        }
    }

    if (!attachments || attachments.length === 0) {
        return (
            <div className="text-center py-4 text-[11px] text-muted-foreground/60 border-2 border-dashed border-muted/50 rounded-2xl flex flex-col items-center gap-2">
                <FileText className="h-4 w-4 opacity-20" />
                Henüz dosya eklenmemiş.
            </div>
        )
    }

    return (
        <>
            {/* Selection Mode Toggle & Bulk Actions */}
            {deletableAttachments.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode)
                                if (isSelectionMode) setSelectedIds([])
                            }}
                            className={clsx(
                                "text-[10px] px-2 py-1 rounded-lg transition-colors",
                                isSelectionMode
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            {isSelectionMode ? 'Seçimi Kapat' : 'Çoklu Seç'}
                        </button>

                        {/* Tümünü Sil Butonu */}
                        <button
                            onClick={() => setConfirmDeleteAll(true)}
                            disabled={isDeletingAll}
                            className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 font-medium hover:bg-rose-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                            {isDeletingAll ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Trash2 className="h-3 w-3" />
                            )}
                            Tümünü Sil
                        </button>
                    </div>

                    {isSelectionMode && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={allDeletableSelected ? deselectAll : selectAll}
                                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {allDeletableSelected ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
                            </button>
                            {selectedIds.length > 0 && (
                                <button
                                    onClick={() => setConfirmDeleteIds(selectedIds)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 font-medium hover:bg-rose-500/20 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 className="h-3 w-3" />
                                    {selectedIds.length} Sil
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-2">
                <AnimatePresence>
                    {attachments.map((attachment, index) => (
                        <motion.div
                            key={attachment.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className={clsx(
                                "flex items-center gap-3 p-3 rounded-xl border transition-all group",
                                deletingIds.includes(attachment.id) && "opacity-50",
                                selectedIds.includes(attachment.id)
                                    ? "bg-primary/10 border-primary/30"
                                    : "bg-accent/20 border-accent/30 hover:bg-accent/30"
                            )}
                        >
                            {/* Selection Checkbox */}
                            {isSelectionMode && canDeleteAttachment(attachment) && (
                                <button
                                    onClick={() => toggleSelection(attachment.id)}
                                    className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                >
                                    {selectedIds.includes(attachment.id) ? (
                                        <CheckSquare className="h-5 w-5 text-primary" />
                                    ) : (
                                        <Square className="h-5 w-5" />
                                    )}
                                </button>
                            )}

                            {/* File Icon */}
                            <span className="text-xl flex-shrink-0">
                                {getFileIcon(attachment.file_type)}
                            </span>

                            {/* File Info */}
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="text-sm font-medium truncate leading-tight max-w-[200px]" title={attachment.file_name}>
                                    {attachment.file_name}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>{formatFileSize(attachment.file_size)}</span>
                                    <span>•</span>
                                    <span>{formatDate(attachment.created_at)}</span>
                                    {attachment.profile && (
                                        <>
                                            <span>•</span>
                                            <span className="truncate max-w-[80px]">
                                                {attachment.profile.full_name || attachment.profile.email?.split('@')[0]}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            {!isSelectionMode && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleView(attachment)}
                                        className="p-2 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors"
                                        title="Görüntüle"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDownload(attachment)}
                                        className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                        title="İndir"
                                    >
                                        <Download className="h-4 w-4" />
                                    </button>
                                    {canDeleteAttachment(attachment) && (
                                        <button
                                            onClick={() => setConfirmDeleteIds([attachment.id])}
                                            disabled={deletingIds.includes(attachment.id)}
                                            className="p-2 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors disabled:opacity-50"
                                            title="Sil"
                                        >
                                            {deletingIds.includes(attachment.id) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                isOpen={confirmDeleteIds.length > 0}
                onClose={() => setConfirmDeleteIds([])}
                onConfirm={() => {
                    if (confirmDeleteIds.length === 1) {
                        handleDeleteSingle(confirmDeleteIds[0])
                    } else {
                        handleDeleteMultiple()
                    }
                }}
                title={confirmDeleteIds.length > 1 ? `${confirmDeleteIds.length} Dosyayı Sil` : "Dosyayı Sil"}
                description={
                    confirmDeleteIds.length > 1
                        ? `Seçili ${confirmDeleteIds.length} dosyayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
                        : "Bu dosyayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
                }
                confirmText={confirmDeleteIds.length > 1 ? `${confirmDeleteIds.length} Dosya Sil` : "Dosyayı Sil"}
            />

            {/* Confirm Delete All Dialog */}
            <ConfirmDialog
                isOpen={confirmDeleteAll}
                onClose={() => setConfirmDeleteAll(false)}
                onConfirm={handleDeleteAll}
                title="⚠️ Tüm Dosyaları Sil"
                description={`Bu göreve ait TÜM ${deletableAttachments.length} dosya silinecektir. Bu işlem geri alınamaz! Emin misiniz?`}
                confirmText={`Evet, ${deletableAttachments.length} Dosyayı Sil`}
            />
        </>
    )
}
