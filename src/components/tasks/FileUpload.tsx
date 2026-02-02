'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, Loader2, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { useToast } from '@/components/ui/toast'

interface FileUploadProps {
    taskId: string
    onUploadComplete: () => void
    disabled?: boolean
}

interface FileItem {
    file: File
    id: string
    status: 'pending' | 'uploading' | 'success' | 'error'
    progress: number
    error?: string
}

const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760', 10)
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / (1024 * 1024)

export default function FileUpload({ taskId, onUploadComplete, disabled }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [files, setFiles] = useState<FileItem[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { showToast } = useToast()

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
    }, [disabled])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const validateFile = (file: File): boolean => {
        if (file.size > MAX_FILE_SIZE) {
            showToast(`${file.name}: Dosya boyutu ${MAX_FILE_SIZE_MB}MB'dan büyük olamaz`, 'error')
            return false
        }
        return true
    }

    const addFiles = (newFiles: FileList) => {
        const validFiles: FileItem[] = []
        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i]
            if (validateFile(file)) {
                validFiles.push({
                    file,
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    status: 'pending',
                    progress: 0
                })
            }
        }
        setFiles(prev => [...prev, ...validFiles])
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (disabled) return
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files)
        }
    }, [disabled])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files)
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id))
    }

    const uploadSingleFile = async (fileItem: FileItem): Promise<boolean> => {
        return new Promise((resolve) => {
            const formData = new FormData()
            formData.append('file', fileItem.file)
            formData.append('task_id', taskId)

            const xhr = new XMLHttpRequest()

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100)
                    setFiles(prev => prev.map(f =>
                        f.id === fileItem.id ? { ...f, progress: percent } : f
                    ))
                }
            })

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    setFiles(prev => prev.map(f =>
                        f.id === fileItem.id ? { ...f, status: 'success', progress: 100 } : f
                    ))
                    resolve(true)
                } else {
                    const response = JSON.parse(xhr.responseText)
                    setFiles(prev => prev.map(f =>
                        f.id === fileItem.id ? { ...f, status: 'error', error: response.error || 'Yükleme hatası' } : f
                    ))
                    resolve(false)
                }
            }

            xhr.onerror = () => {
                setFiles(prev => prev.map(f =>
                    f.id === fileItem.id ? { ...f, status: 'error', error: 'Ağ hatası' } : f
                ))
                resolve(false)
            }

            setFiles(prev => prev.map(f =>
                f.id === fileItem.id ? { ...f, status: 'uploading' } : f
            ))

            xhr.open('POST', '/api/attachments')
            xhr.send(formData)
        })
    }

    const handleUploadAll = async () => {
        const pendingFiles = files.filter(f => f.status === 'pending')
        if (pendingFiles.length === 0) return

        setIsUploading(true)

        // Paralel yükleme için Promise.allSettled kullan
        const results = await Promise.allSettled(
            pendingFiles.map(fileItem => uploadSingleFile(fileItem))
        )

        const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length

        setIsUploading(false)

        if (successCount > 0) {
            showToast(`${successCount} dosya başarıyla yüklendi`, 'success')
            onUploadComplete()
            // Başarılı dosyaları temizle
            setTimeout(() => {
                setFiles(prev => prev.filter(f => f.status !== 'success'))
            }, 1500)
        }
    }

    const clearAllFiles = () => {
        setFiles([])
    }

    const pendingCount = files.filter(f => f.status === 'pending').length

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    const getFileIcon = (type: string): string => {
        if (type.startsWith('image/')) return '🖼️'
        if (type.includes('pdf')) return '📄'
        if (type.includes('word') || type.includes('document')) return '📝'
        if (type.includes('excel') || type.includes('spreadsheet')) return '📊'
        if (type.includes('zip') || type.includes('rar')) return '📦'
        if (type.includes('text')) return '📃'
        return '📎'
    }

    if (disabled) return null

    return (
        <div className="space-y-3">
            {/* Drag & Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                    "relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200",
                    isDragging
                        ? "border-primary bg-primary/5 scale-[1.02]"
                        : "border-muted/50 hover:border-primary/50 hover:bg-accent/30",
                    isUploading && "pointer-events-none opacity-60"
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                />

                <AnimatePresence mode="wait">
                    {isDragging ? (
                        <motion.div
                            key="dragging"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <Upload className="h-8 w-8 text-primary animate-bounce" />
                            <span className="text-sm font-medium text-primary">Dosyaları bırakın</span>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="default"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <div className="h-10 w-10 rounded-xl bg-accent/50 flex items-center justify-center">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground">
                                    Dosyaları sürükleyin veya{' '}
                                    <span className="text-primary font-medium">seçin</span>
                                </span>
                                <p className="text-[10px] text-muted-foreground/60 mt-1">
                                    Çoklu dosya desteklenir • Maks. {MAX_FILE_SIZE_MB}MB
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Selected Files List */}
            <AnimatePresence>
                {files.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-2"
                    >
                        {files.map((fileItem) => (
                            <motion.div
                                key={fileItem.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className={clsx(
                                    "flex items-center gap-3 p-2.5 rounded-xl border transition-all",
                                    fileItem.status === 'success' && "bg-emerald-500/10 border-emerald-500/30",
                                    fileItem.status === 'error' && "bg-red-500/10 border-red-500/30",
                                    fileItem.status === 'pending' && "bg-accent/30 border-accent/50",
                                    fileItem.status === 'uploading' && "bg-primary/5 border-primary/30"
                                )}
                            >
                                <span className="text-xl">{getFileIcon(fileItem.file.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatFileSize(fileItem.file.size)}
                                        </span>
                                        {fileItem.status === 'uploading' && (
                                            <span className="text-[10px] text-primary font-medium">
                                                %{fileItem.progress}
                                            </span>
                                        )}
                                        {fileItem.status === 'success' && (
                                            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                                                <CheckCircle className="h-3 w-3" /> Yüklendi
                                            </span>
                                        )}
                                        {fileItem.status === 'error' && (
                                            <span className="text-[10px] text-red-500 font-medium">
                                                {fileItem.error}
                                            </span>
                                        )}
                                    </div>
                                    {fileItem.status === 'uploading' && (
                                        <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden mt-1">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${fileItem.progress}%` }}
                                                className="h-full bg-primary rounded-full"
                                            />
                                        </div>
                                    )}
                                </div>
                                {(fileItem.status === 'pending' || fileItem.status === 'error') && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFile(fileItem.id) }}
                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <X className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                )}
                                {fileItem.status === 'uploading' && (
                                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                )}
                            </motion.div>
                        ))}

                        {/* Action Buttons */}
                        {pendingCount > 0 && !isUploading && (
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={handleUploadAll}
                                    className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload className="h-4 w-4" />
                                    {pendingCount} Dosya Yükle
                                </button>
                                <button
                                    onClick={clearAllFiles}
                                    className="py-2 px-3 bg-muted text-muted-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors"
                                >
                                    Temizle
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
