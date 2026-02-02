'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, Save } from 'lucide-react'
import { InitialsAvatar } from '@/components/ui/InitialsAvatar'

export default function ProfilePage() {
    const { user, profile, setProfile } = useAuthStore()
    const [fullName, setFullName] = useState(profile?.full_name || '')
    const [department, setDepartment] = useState(profile?.department || '')
    const [role, setRole] = useState(profile?.role || 'user')
    const [branch, setBranch] = useState(profile?.branch || '')
    const [meetingType, setMeetingType] = useState(profile?.meeting_type || '')
    const [loading, setLoading] = useState(false)
    const { showToast } = useToast()
    const router = useRouter()

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '')
            setDepartment(profile.department || '')
            setRole(profile.role || 'user')
            setBranch(profile.branch || '')
            setMeetingType(profile.meeting_type || '')
        }
    }, [profile])

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setLoading(true)
        try {
            const res = await fetch('/api/profiles/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    department: department,
                    role: role,
                    branch: branch,
                    meeting_type: meetingType
                })
            })

            if (!res.ok) {
                const err = await res.json()
                showToast(`Güncelleme hatası: ${err.error}`, 'error')
            } else {
                // Update local state
                setProfile({
                    ...profile!,
                    full_name: fullName,
                    department: department,
                    role: role as any,
                    branch: branch,
                    meeting_type: meetingType
                })
                showToast('Profil başarıyla güncellendi!', 'success')
                router.push('/')
            }
        } catch (error) {
            showToast('Güncelleme hatası', 'error')
        }
        setLoading(false)
    }

    const isSuperadmin = profile?.role === 'superadmin'
    const isSecretary = role === 'secretary'

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">Profil Ayarları</h1>
                </header>

                <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-8">
                    <div className="flex flex-col items-center gap-4">
                        <InitialsAvatar
                            name={fullName}
                            email={user?.email}
                            className="h-24 w-24 rounded-full border-2 border-primary/20 text-3xl"
                            textClassName="text-3xl"
                        />
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Profil Baş Harfleri</p>
                    </div>

                    <form onSubmit={handleUpdate} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Ad Soyad</label>
                                <Input
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Adınız Soyadınız"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Birim / Departman</label>
                                <Input
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    placeholder="Örn: Bilgi İşlem"
                                />
                            </div>
                        </div>

                        {isSuperadmin && (
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Rol (Yalnızca Superadmin)</label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as any)}
                                        className="w-full px-3 py-2 border rounded-md bg-background"
                                    >
                                        <option value="user">Kullanıcı</option>
                                        <option value="admin">Admin</option>
                                        <option value="secretary">Sekreter</option>
                                        <option value="superadmin">Superadmin</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Hastane Şubesi</label>
                                    <select
                                        value={branch}
                                        onChange={(e) => setBranch(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md bg-background"
                                    >
                                        <option value="">Şube Seçin</option>
                                        <option value="Site 1">Site 1</option>
                                        <option value="Site 2">Site 2</option>
                                        <option value="Site 3">Site 3</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {isSecretary && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Toplantı Türü (Sekreter İçin)</label>
                                <Input
                                    value={meetingType}
                                    onChange={(e) => setMeetingType(e.target.value)}
                                    placeholder="Örn: Kalite Kurulu, Yönetim Kurulu"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">E-posta (Değiştirilemez)</label>
                            <Input
                                value={user?.email || ''}
                                disabled
                                className="bg-muted opacity-60"
                            />
                        </div>

                        <div className="flex justify-end pt-4 gap-3">
                            <Button type="button" variant="outline" onClick={() => router.back()}>
                                İptal
                            </Button>
                            <Button type="submit" disabled={loading} className="gap-2">
                                <Save className="h-4 w-4" />
                                {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Zimbra Sync Card */}
                <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Zimbra Eşitleme</h2>
                            <p className="text-sm text-muted-foreground">Görevlerinizin kurumsal mail hesabınızla senkronizasyonu.</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${profile?.zimbra_sync_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {profile?.zimbra_sync_enabled ? 'Aktif' : 'Pasif'}
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-dashed text-sm">
                            <span className="text-muted-foreground">Son Eşitleme</span>
                            <span className="font-medium">
                                {profile?.zimbra_last_sync
                                    ? new Date(profile.zimbra_last_sync).toLocaleString('tr-TR')
                                    : 'Henüz yapılmadı'}
                            </span>
                        </div>

                        <Button
                            variant={profile?.zimbra_sync_enabled ? "outline" : "primary"}
                            className="w-full py-6 rounded-xl"
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const res = await fetch('/api/profiles/me', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ zimbra_sync_enabled: !profile?.zimbra_sync_enabled })
                                    });
                                    if (res.ok) {
                                        const updated = await res.json();
                                        setProfile(updated);
                                        showToast(updated.zimbra_sync_enabled ? 'Eşitleme aktif edildi' : 'Eşitleme durduruldu', 'success');
                                    }
                                } catch (e) {
                                    showToast('Bir hata oluştu', 'error');
                                }
                                setLoading(false);
                            }}
                        >
                            {profile?.zimbra_sync_enabled ? 'Eşitlemeyi Durdur' : 'Eşitlemeyi Başlat'}
                        </Button>
                    </div>
                </div>

                {/* Telegram Bot Card */}
                <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Telegram Bildirimleri</h2>
                            <p className="text-sm text-muted-foreground">Mobil cihazınızdan görev takibi yapın.</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${profile?.telegram_user_id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {profile?.telegram_user_id ? 'Bağlı' : 'Bağlı Değil'}
                        </div>
                    </div>

                    {!profile?.telegram_user_id && (
                        <div className="pt-2">
                            <Button
                                variant="outline"
                                className="w-full py-6 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
                                onClick={() => window.open('https://t.me/clawdbot5449bot', '_blank')}
                            >
                                @clawdbot5449bot ile Bağlan
                            </Button>
                            <p className="text-[10px] text-center text-muted-foreground mt-3 leading-relaxed">
                                Botu başlatıp <strong>/start</strong> komutu ile emailinizi onaylayarak<br />
                                bildirimleri almaya başlayabilirsiniz.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
