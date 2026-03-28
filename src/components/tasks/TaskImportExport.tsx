'use client'

import { useState } from 'react'
import { Download, Upload, FileSpreadsheet, Sparkles, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToastStore } from '@/components/ui/toast'

interface TaskImportExportProps {
    listId: string
    listName: string
}

// Görev şablonu için sütun başlıkları
const TEMPLATE_COLUMNS = ['Görev Adı', 'Açıklama', 'Öncelik', 'Bitiş Tarihi', 'Atananlar']
const TEMPLATE_EXAMPLE = [
    'Arşiv sürecini gözden geçir',
    'Tüm kayıtların dijital ortama aktarılması',
    'Yüksek',
    '30.06.2026',
    'Ahmet Yılmaz, Fatma Kaya'
]

interface ParsedTask {
    title: string
    description: string
    priority: string
    due_date_str: string
    assignees: string
}

export default function TaskImportExport({ listId, listName }: TaskImportExportProps) {
    const [isImporting, setIsImporting] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [showAIImport, setShowAIImport] = useState(false)
    const [aiText, setAIText] = useState('')
    const [isParsingAI, setIsParsingAI] = useState(false)
    const [parsedTasks, setParsedTasks] = useState<ParsedTask[] | null>(null)
    const [isSubmittingParsed, setIsSubmittingParsed] = useState(false)
    const showToast = useToastStore((state) => state.showToast)

    const handleExport = async (format: 'xlsx' | 'csv') => {
        try {
            setIsExporting(true)
            const response = await fetch(`/api/tasks/export?list_id=${listId}&format=${format}`)
            
            if (!response.ok) throw new Error('Export failed')

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

    const handleDownloadTemplate = () => {
        const header = TEMPLATE_COLUMNS.join(',')
        const example = TEMPLATE_EXAMPLE.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')
        const csvContent = '\uFEFF' + header + '\n' + example  // BOM for Excel Turkish charset
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'görev_import_şablonu.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        showToast('Şablon indirildi — Excel ile düzenleyip geri yükleyebilirsiniz', 'success')
    }

    const handleImport = async (file: File) => {
        try {
            setIsImporting(true)
            const formData = new FormData()
            formData.append('file', file)
            formData.append('list_id', listId)

            const response = await fetch('/api/tasks/import', { method: 'POST', body: formData })
            const result = await response.json()

            if (!response.ok) throw new Error(result.error || 'Import failed')

            showToast(
                `✅ ${result.imported} görev içe aktarıldı${result.errors > 0 ? `, ${result.errors} hata` : ''}`,
                result.errors > 0 ? 'error' : 'success'
            )
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
            if (file) handleImport(file)
        }
        input.click()
    }

    const handleAIParse = async () => {
        if (!aiText.trim()) return
        setIsParsingAI(true)
        setParsedTasks(null)
        try {
            const response = await fetch('/api/ai/parse-tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: aiText })
            })
            if (!response.ok) throw new Error('AI analizi başarısız oldu')
            const result = await response.json()
            if (!Array.isArray(result.tasks) || result.tasks.length === 0) {
                showToast('AI görev bulamadı — metni kontrol edin', 'error')
                return
            }
            setParsedTasks(result.tasks)
        } catch (err: any) {
            console.error('AI parse error:', err)
            showToast(`AI hatası: ${err.message}`, 'error')
        } finally {
            setIsParsingAI(false)
        }
    }

    const handleSubmitParsed = async () => {
        if (!parsedTasks?.length) return
        setIsSubmittingParsed(true)
        try {
            const header = TEMPLATE_COLUMNS.join(',')
            const rows = parsedTasks.map((t) =>
                [t.title, t.description, t.priority, t.due_date_str, t.assignees]
                    .map((v) => `"${(v || '').replace(/"/g, '""')}"`)
                    .join(',')
            )
            const csvContent = '\uFEFF' + header + '\n' + rows.join('\n')
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const file = new File([blob], 'ai_import.csv', { type: 'text/csv' })

            const formData = new FormData()
            formData.append('file', file)
            formData.append('list_id', listId)

            const response = await fetch('/api/tasks/import', { method: 'POST', body: formData })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Import failed')

            showToast(`✅ ${result.imported} görev içe aktarıldı`, 'success')
            setShowAIImport(false)
            setParsedTasks(null)
            setAIText('')
            window.location.reload()
        } catch (err: any) {
            showToast(`İçe aktarma hatası: ${err.message}`, 'error')
        } finally {
            setIsSubmittingParsed(false)
        }
    }

    return (
        <>
            <div className="flex items-center gap-1">
                {/* Export Dropdown */}
                <div className="relative group">
                    <Button variant="ghost" size="sm" className="h-7 px-2" disabled={isExporting} title="Dışa Aktar">
                        {isExporting
                            ? <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                            : <Download className="h-3.5 w-3.5" />}
                    </Button>
                    <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px]">
                        <div className="p-1">
                            <button onClick={() => handleExport('xlsx')} className="w-full px-3 py-2 text-sm hover:bg-accent rounded flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel (.xlsx)
                            </button>
                            <button onClick={() => handleExport('csv')} className="w-full px-3 py-2 text-sm hover:bg-accent rounded flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-blue-600" /> CSV (.csv)
                            </button>
                            <hr className="my-1" />
                            <button onClick={handleDownloadTemplate} className="w-full px-3 py-2 text-sm hover:bg-accent rounded flex items-center gap-2 text-muted-foreground">
                                <Download className="h-4 w-4" /> Şablon İndir
                            </button>
                        </div>
                    </div>
                </div>

                {/* Import Button */}
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={triggerFileInput} disabled={isImporting} title="İçe Aktar (Excel/CSV)">
                    {isImporting
                        ? <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                        : <Upload className="h-3.5 w-3.5" />}
                </Button>

                {/* AI Import Button */}
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowAIImport(true)} title="AI ile içe aktar — Metin olarak görev listeni gir">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                </Button>
            </div>

            {/* AI Import Modal */}
            {showAIImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-violet-500" />
                                <h2 className="font-semibold">AI ile Görev İçe Aktar</h2>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => { setShowAIImport(false); setParsedTasks(null) }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="p-4 space-y-4">
                            {!parsedTasks ? (
                                <>
                                    <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground space-y-1">
                                        <p className="font-medium text-foreground">Nasıl kullanılır?</p>
                                        <p>Aşağıya görev listesini, toplantı notlarını veya iş açıklamalarını yapıştırın. AI yapılandırılmış görevlere dönüştürür.</p>
                                        <p className="text-xs">Örnek: <em>"Arşiv sürecini gözden geçir — Filiz, bitiş: 30 Haziran, yüksek öncelik"</em></p>
                                    </div>
                                    <textarea
                                        value={aiText}
                                        onChange={(e) => setAIText(e.target.value)}
                                        rows={10}
                                        placeholder="Görev metinlerini buraya yapıştırın..."
                                        className="w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="outline" onClick={() => setShowAIImport(false)}>İptal</Button>
                                        <Button onClick={handleAIParse} disabled={!aiText.trim() || isParsingAI} className="gap-2">
                                            {isParsingAI ? (
                                                <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" /> AI Analiz Ediyor...</>
                                            ) : (
                                                <><Sparkles className="h-3.5 w-3.5" /> Analiz Et</>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                        <Check className="h-4 w-4" />
                                        <span>{parsedTasks.length} görev bulundu — kontrol edip onaylayın</span>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted">
                                                <tr>
                                                    <th className="text-left px-3 py-2 font-medium">Görev Adı</th>
                                                    <th className="text-left px-3 py-2 font-medium">Öncelik</th>
                                                    <th className="text-left px-3 py-2 font-medium">Bitiş</th>
                                                    <th className="text-left px-3 py-2 font-medium">Atananlar</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedTasks.map((task, i) => (
                                                    <tr key={i} className="border-t">
                                                        <td className="px-3 py-2 max-w-[200px] truncate" title={task.title}>{task.title}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                                                task.priority === 'Acil' ? 'bg-red-100 text-red-700' :
                                                                task.priority === 'Yüksek' ? 'bg-orange-100 text-orange-700' :
                                                                task.priority === 'Orta' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>{task.priority || 'Orta'}</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-muted-foreground">{task.due_date_str || '—'}</td>
                                                        <td className="px-3 py-2 text-muted-foreground max-w-[150px] truncate" title={task.assignees}>{task.assignees || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="outline" onClick={() => setParsedTasks(null)}>Geri Dön</Button>
                                        <Button onClick={handleSubmitParsed} disabled={isSubmittingParsed} className="gap-2">
                                            {isSubmittingParsed
                                                ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                                                : <Check className="h-3.5 w-3.5" />}
                                            {isSubmittingParsed ? 'İçe Aktarılıyor...' : `${parsedTasks.length} Görevi Ekle`}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

