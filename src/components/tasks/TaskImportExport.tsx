'use client'

import { useState } from 'react'
import { Download, Upload, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToastStore } from '@/components/ui/toast'

interface TaskImportExportProps {
    listId: string
    listName: string
}

export default function TaskImportExport({ listId, listName }: TaskImportExportProps) {
    const [isImporting, setIsImporting] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const showToast = useToastStore((state) => state.showToast)

    const handleExport = async (format: 'xlsx' | 'csv') => {
        try {
            setIsExporting(true)
            const response = await fetch(`/api/tasks/export?list_id=${listId}&format=${format}`)
            
            if (!response.ok) {
                throw new Error('Export failed')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${listName}_${new Date().toISOString().split('T')[0]}.${format}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)

            showToast(`${format.toUpperCase()} dosyası indirildi`, 'success')
        } catch (error) {
            console.error('Export error:', error)
            showToast('Dışa aktarma başarısız oldu', 'error')
        } finally {
            setIsExporting(false)
        }
    }

    const handleImport = async (file: File) => {
        try {
            setIsImporting(true)
            
            const formData = new FormData()
            formData.append('file', file)
            formData.append('list_id', listId)

            const response = await fetch('/api/tasks/import', {
                method: 'POST',
                body: formData
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Import failed')
            }

            showToast(
                `✅ ${result.imported} görev içe aktarıldı${result.errors > 0 ? `, ${result.errors} hata` : ''}`,
                result.errors > 0 ? 'error' : 'success'
            )

            // Reload page to show new tasks
            window.location.reload()

        } catch (error: any) {
            console.error('Import error:', error)
            showToast(`İçe aktarma başarısız: ${error.message}`, 'error')
        } finally {
            setIsImporting(false)
        }
    }

    const triggerFileInput = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.xlsx,.xls,.csv'
        input.onchange = (e: any) => {
            const file = e.target.files?.[0]
            if (file) {
                handleImport(file)
            }
        }
        input.click()
    }

    return (
        <div className="flex items-center gap-1">
            {/* Export Dropdown */}
            <div className="relative group">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={isExporting}
                    title="Dışa Aktar"
                >
                    {isExporting ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                    ) : (
                        <Download className="h-3.5 w-3.5" />
                    )}
                </Button>
                
                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
                    <div className="p-1">
                        <button
                            onClick={() => handleExport('xlsx')}
                            className="w-full px-3 py-2 text-sm hover:bg-accent rounded flex items-center gap-2"
                        >
                            <FileSpreadsheet className="h-4 w-4 text-green-600" />
                            Excel (.xlsx)
                        </button>
                        <button
                            onClick={() => handleExport('csv')}
                            className="w-full px-3 py-2 text-sm hover:bg-accent rounded flex items-center gap-2"
                        >
                            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                            CSV (.csv)
                        </button>
                    </div>
                </div>
            </div>

            {/* Import Button */}
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={triggerFileInput}
                disabled={isImporting}
                title="İçe Aktar (Excel/CSV)"
            >
                {isImporting ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                ) : (
                    <Upload className="h-3.5 w-3.5" />
                )}
            </Button>
        </div>
    )
}
