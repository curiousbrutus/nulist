'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'

interface StaffMember {
    id: string
    full_name: string
    email: string
    role: string
    branch: string
    zimbra_sync_enabled: number
    zimbra_last_sync: string | null
}

export default function SecretarySyncDashboard() {
    const { profile } = useAuthStore()
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const { showToast } = useToast()
    const router = useRouter()

    useEffect(() => {
        if (profile && profile.role !== 'secretary' && profile.role !== 'superadmin') {
            showToast('Yetkisiz erişim', 'error')
            router.push('/')
            return
        }
        fetchStaff()
    }, [profile])

    const fetchStaff = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/profiles/all')
            if (!res.ok) throw new Error('Yüklenemedi')
            const all = await res.json()

            // Filter by branch
            const branchStaff = profile?.role === 'secretary'
                ? all.filter((s: StaffMember) => s.branch === profile.branch)
                : all

            setStaff(branchStaff)
        } catch (e) {
            showToast('Personel listesi alınamadı', 'error')
        } finally {
            setLoading(false)
        }
    }

    const toggleSync = async (staffId: string, currentStatus: number) => {
        setActionLoading(staffId)
        try {
            const res = await fetch(`/api/profiles/admin/update-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: staffId,
                    enabled: currentStatus === 0 ? 1 : 0
                })
            })

            if (res.ok) {
                showToast('Eşitleme durumu güncellendi', 'success')
                fetchStaff()
            } else {
                showToast('Güncellenemedi', 'error')
            }
        } catch (e) {
            showToast('Sistem hatası', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    if (!profile || (profile.role !== 'secretary' && profile.role !== 'superadmin')) {
        return null
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 text-foreground">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">Birim Eşitleme Yönetimi</h1>
                            <p className="text-sm text-muted-foreground">
                                {profile.branch} Şubesi Personel Zimbra Yönetimi
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchStaff} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Yenile
                    </Button>
                </header>

                <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/50 border-b">
                                    <th className="p-4 font-semibold text-sm">Personel</th>
                                    <th className="p-4 font-semibold text-sm">Zimbra Durumu</th>
                                    <th className="p-4 font-semibold text-sm text-center">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staff.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-muted-foreground">
                                            {loading ? 'Yükleniyor...' : 'Biriminizde personel bulunamadı.'}
                                        </td>
                                    </tr>
                                ) : (
                                    staff.map((s) => (
                                        <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <div className="font-medium text-sm">{s.full_name}</div>
                                                <div className="text-xs text-muted-foreground">{s.email}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {s.zimbra_sync_enabled ? (
                                                        <span className="flex items-center text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">
                                                            <CheckCircle2 className="h-3 w-3 mr-1" /> AKTİF
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center text-xs text-gray-500 font-bold bg-gray-50 px-2 py-1 rounded">
                                                            <XCircle className="h-3 w-3 mr-1" /> PASİF
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1">
                                                    Son: {s.zimbra_last_sync ? new Date(s.zimbra_last_sync).toLocaleString('tr-TR') : 'Hiç'}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <Button
                                                    variant={s.zimbra_sync_enabled ? "outline" : "primary"}
                                                    size="sm"
                                                    disabled={actionLoading === s.id}
                                                    onClick={() => toggleSync(s.id, s.zimbra_sync_enabled)}
                                                    className="w-24 text-xs h-8"
                                                >
                                                    {actionLoading === s.id ? '...' : (s.zimbra_sync_enabled ? 'Durdur' : 'Başlat')}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3 items-start">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <RefreshCw className="h-4 w-4" />
                    </div>
                    <div className="text-xs leading-relaxed text-blue-800">
                        <strong>Bilgi:</strong> Eşitleme başlatılan personelin görevleri, Zimbra "NeoList Görevlerim" klasörüne
                        otomatik olarak kopyalanacaktır. Personel bu ayarı profil sayfasından kendisi de değiştirebilir.
                    </div>
                </div>
            </div>
        </div>
    )
}
