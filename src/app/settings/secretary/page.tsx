'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react'

interface User {
    id: string
    full_name: string
    email: string
    department: string
    branch: string
}

export default function SecretaryExportPage() {
    const { user, profile } = useAuthStore()
    const [users, setUsers] = useState<User[]>([])
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [meetingType, setMeetingType] = useState('')
    const [loading, setLoading] = useState(false)
    const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
    const { showToast } = useToast()
    const router = useRouter()

    useEffect(() => {
        // Check authorization
        if (profile && profile.role !== 'secretary' && profile.role !== 'superadmin') {
            showToast('Bu sayfaya erişim yetkiniz yok', 'error')
            router.push('/')
            return
        }

        // Fetch users in the same branch (for secretaries)
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/profiles/all')
                if (!res.ok) throw new Error('Failed to fetch users')
                
                const allUsers = await res.json()
                
                // Filter by branch if secretary
                const filteredUsers = profile?.role === 'secretary' && profile.branch
                    ? allUsers.filter((u: User) => u.branch === profile.branch)
                    : allUsers
                
                setUsers(filteredUsers)
            } catch (error) {
                showToast('Kullanıcılar yüklenemedi', 'error')
            }
        }

        fetchUsers()
    }, [profile, router, showToast])

    const handleUserToggle = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const handleSelectAll = () => {
        if (selectedUserIds.length === users.length) {
            setSelectedUserIds([])
        } else {
            setSelectedUserIds(users.map(u => u.id))
        }
    }

    const handleExport = async () => {
        if (selectedUserIds.length === 0) {
            showToast('Lütfen en az bir kullanıcı seçin', 'error')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/tasks/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_ids: selectedUserIds,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    meeting_type: meetingType || null,
                    format: format
                })
            })

            if (!res.ok) {
                const err = await res.json()
                showToast(err.error || 'Export hatası', 'error')
                return
            }

            // Download file
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `sekreter-raporu-${new Date().toISOString().split('T')[0]}.${format}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            showToast('Rapor başarıyla indirildi', 'success')
        } catch (error) {
            showToast('Export hatası', 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!profile || (profile.role !== 'secretary' && profile.role !== 'superadmin')) {
        return null
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Sekreter Rapor Çıkartma</h1>
                        <p className="text-sm text-muted-foreground">
                            {profile.role === 'secretary' ? `Şube: ${profile.branch}` : 'Tüm şubeler'}
                        </p>
                    </div>
                </header>

                <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
                    {/* Date Filters */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Başlangıç Tarihi</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Bitiş Tarihi</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Meeting Type Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Toplantı Türü (Opsiyonel)</label>
                        <Input
                            value={meetingType}
                            onChange={(e) => setMeetingType(e.target.value)}
                            placeholder="Örn: Kalite Kurulu, Yönetim Kurulu"
                        />
                    </div>

                    {/* Format Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Dosya Formatı</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="format"
                                    value="xlsx"
                                    checked={format === 'xlsx'}
                                    onChange={(e) => setFormat(e.target.value as 'xlsx')}
                                    className="w-4 h-4"
                                />
                                <span>Excel (.xlsx)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="format"
                                    value="csv"
                                    checked={format === 'csv'}
                                    onChange={(e) => setFormat(e.target.value as 'csv')}
                                    className="w-4 h-4"
                                />
                                <span>CSV (.csv)</span>
                            </label>
                        </div>
                    </div>

                    {/* User Selection */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">
                                Kullanıcılar ({selectedUserIds.length} / {users.length} seçili)
                            </label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAll}
                            >
                                {selectedUserIds.length === users.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                            </Button>
                        </div>
                        <div className="border rounded-lg max-h-64 overflow-y-auto p-2 space-y-1">
                            {users.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Kullanıcı bulunamadı
                                </p>
                            ) : (
                                users.map(user => (
                                    <label
                                        key={user.id}
                                        className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.includes(user.id)}
                                            onChange={() => handleUserToggle(user.id)}
                                            className="w-4 h-4"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{user.full_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {user.email} • {user.department || 'Birim belirtilmemiş'}
                                            </p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Export Button */}
                    <div className="flex justify-end pt-4 gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                        >
                            İptal
                        </Button>
                        <Button
                            onClick={handleExport}
                            disabled={loading || selectedUserIds.length === 0}
                            className="gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    İndiriliyor...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" />
                                    Rapor İndir
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
