'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, Save } from 'lucide-react'
import { InitialsAvatar } from '@/components/ui/InitialsAvatar'
import { QRCodeSVG } from 'qrcode.react'

interface FacilityOption {
    id: string
    name: string
}

interface DepartmentOption {
    id: string
    name: string
    facility_id: string
    facility_name?: string
}

const FALLBACK_BRANCHES: FacilityOption[] = [
    { id: 'fallback-corlu', name: 'Çorlu' },
    { id: 'fallback-kapakli', name: 'Kapaklı' },
    { id: 'fallback-cerkezkoy', name: 'Çerkezköy' }
]

export default function ProfilePage() {
    const { user, profile, setProfile } = useAuthStore()
    const [fullName, setFullName] = useState(profile?.full_name || '')
    const [department, setDepartment] = useState(profile?.department || '')
    const [jobTitle, setJobTitle] = useState(profile?.job_title || '')
    const [phone, setPhone] = useState(profile?.phone || '')
    const [role, setRole] = useState(profile?.role || 'user')
    const [branch, setBranch] = useState(profile?.branch || '')
    const [meetingType, setMeetingType] = useState(profile?.meeting_type || '')
    const [facilities, setFacilities] = useState<FacilityOption[]>([])
    const [departments, setDepartments] = useState<DepartmentOption[]>([])
    const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])
    const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([])
    const [managerCandidates, setManagerCandidates] = useState<any[]>([])
    const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([])
    const [candidateToAdd, setCandidateToAdd] = useState('')
    const [loading, setLoading] = useState(false)
    const { showToast } = useToast()
    const router = useRouter()

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [managerRes, facilitiesRes, departmentsRes, assignmentsRes] = await Promise.all([
                    fetch('/api/profiles/managers'),
                    fetch('/api/org/facilities'),
                    fetch('/api/org/departments'),
                    fetch('/api/org/assignments')
                ])

                if (managerRes.ok) {
                    const managerData = await managerRes.json()
                    setManagerCandidates(Array.isArray(managerData) ? managerData : [])
                }

                if (facilitiesRes.ok) {
                    const facilityData = await facilitiesRes.json()
                    const normalizedFacilities = Array.isArray(facilityData)
                        ? facilityData
                            .map((item: any) => ({
                                id: item.id || item.ID,
                                name: item.name || item.NAME
                            }))
                            .filter((item: FacilityOption) => Boolean(item.id && item.name))
                        : []
                    setFacilities(normalizedFacilities)
                }

                if (departmentsRes.ok) {
                    const departmentData = await departmentsRes.json()
                    const normalizedDepartments = Array.isArray(departmentData)
                        ? departmentData
                            .map((item: any) => ({
                                id: item.id || item.ID,
                                name: item.name || item.NAME,
                                facility_id: item.facility_id || item.FACILITY_ID,
                                facility_name: item.facility_name || item.FACILITY_NAME
                            }))
                            .filter((item: DepartmentOption) => Boolean(item.id && item.name && item.facility_id))
                        : []
                    setDepartments(normalizedDepartments)
                }

                if (assignmentsRes.ok) {
                    const assignmentData = await assignmentsRes.json()
                    setSelectedFacilityIds(Array.isArray(assignmentData?.facility_ids) ? assignmentData.facility_ids : [])
                    setSelectedDepartmentIds(Array.isArray(assignmentData?.department_ids) ? assignmentData.department_ids : [])
                }
            } catch {
                // Silent fail, page still works with fallback options
            }
        }

        loadInitialData()
    }, [])

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '')
            setDepartment(profile.department || '')
            setJobTitle(profile.job_title || '')
            setPhone(profile.phone || '')
            setRole(profile.role || 'user')
            setBranch(profile.branch || '')
            setMeetingType(profile.meeting_type || '')
            const idsFromProfile = Array.isArray(profile.manager_ids)
                ? profile.manager_ids
                : profile.manager_id
                    ? [profile.manager_id]
                    : []
            setSelectedManagerIds(idsFromProfile)

            if (Array.isArray(profile.managers) && profile.managers.length > 0) {
                setManagerCandidates((prev) => {
                    const existingIds = new Set(prev.map((item) => item.id))
                    const merged = [...prev]
                    profile.managers?.forEach((manager) => {
                        if (!existingIds.has(manager.id)) {
                            merged.push(manager)
                        }
                    })
                    return merged
                })
            }
        }
    }, [profile])

    const selectedManagers = managerCandidates.filter((candidate) => selectedManagerIds.includes(candidate.id))
    const availableManagers = managerCandidates.filter((candidate) => !selectedManagerIds.includes(candidate.id))
    const facilityOptions = facilities.length > 0 ? facilities : FALLBACK_BRANCHES
    const selectedFacilities = facilityOptions.filter((facility) => selectedFacilityIds.includes(facility.id))
    const selectedDepartments = departments.filter((departmentOption) => selectedDepartmentIds.includes(departmentOption.id))

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
                    job_title: jobTitle,
                    phone: phone,
                    role: role,
                    branch: branch,
                    meeting_type: meetingType,
                    manager_ids: selectedManagerIds
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
                    job_title: jobTitle,
                    phone: phone,
                    role: role as any,
                    branch: branch,
                    facility_ids: selectedFacilityIds,
                    department_ids: selectedDepartmentIds,
                    meeting_type: meetingType,
                    manager_ids: selectedManagerIds,
                    manager_id: selectedManagerIds[0]
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

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Ünvan</label>
                                <Input
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    placeholder="Örn: Sorumlu Hemşire"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Telefon</label>
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Örn: 05xx xxx xx xx"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Hastane Şubesi</label>
                            <Input value={branch || 'Atama ile belirleniyor'} disabled className="bg-muted opacity-70" />
                        </div>

                        <div className="space-y-3">
                            <div className="rounded-lg border p-3 bg-muted/20 space-y-3">
                                <div>
                                    <p className="text-sm font-medium">Bağlı Şubeler</p>
                                    {selectedFacilities.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {selectedFacilities.map((facility) => (
                                                <span key={facility.id} className="text-xs px-2 py-1 rounded-full bg-muted border">
                                                    {facility.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground mt-1">Atama bulunamadı.</p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-sm font-medium">Bağlı Departmanlar</p>
                                    {selectedDepartments.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {selectedDepartments.map((departmentOption) => (
                                                <span key={departmentOption.id} className="text-xs px-2 py-1 rounded-full bg-muted border">
                                                    {departmentOption.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground mt-1">Atama bulunamadı.</p>
                                    )}
                                </div>

                                <Link href="/settings/sync" className="inline-flex">
                                    <Button type="button" variant="outline" size="sm">Birim Yönetimine Git</Button>
                                </Link>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium">Yöneticilerim</label>
                            <div className="flex gap-2">
                                <select
                                    value={candidateToAdd}
                                    onChange={(e) => setCandidateToAdd(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md bg-background"
                                >
                                    <option value="">Yönetici seçin</option>
                                    {availableManagers.map((manager) => (
                                        <option key={manager.id} value={manager.id}>
                                            {manager.full_name || manager.email} {manager.branch ? `(${manager.branch})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        if (!candidateToAdd) return
                                        setSelectedManagerIds((prev) => [...prev, candidateToAdd])
                                        setCandidateToAdd('')
                                    }}
                                    disabled={!candidateToAdd}
                                >
                                    Ekle
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {selectedManagers.length === 0 && (
                                    <p className="text-sm text-muted-foreground">Henüz yönetici seçmediniz.</p>
                                )}
                                {selectedManagers.map((manager) => (
                                    <div key={manager.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">{manager.full_name || manager.email}</p>
                                            <p className="text-xs text-muted-foreground">{manager.department || '-'} {manager.branch ? `• ${manager.branch}` : ''}</p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setSelectedManagerIds((prev) => prev.filter((id) => id !== manager.id))}
                                        >
                                            Kaldır
                                        </Button>
                                    </div>
                                ))}
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
                                <div className="space-y-2" />
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
                        <div className="pt-2 space-y-4">
                            <div className="flex flex-col items-center gap-3">
                                <div className="bg-white p-3 rounded-xl border">
                                    <QRCodeSVG
                                        value="https://t.me/clawdbot5449bot"
                                        size={160}
                                        level="M"
                                        includeMargin={false}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Telefonunuzla QR kodu tarayarak botu açabilirsiniz
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full py-6 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
                                onClick={() => window.open('https://t.me/clawdbot5449bot', '_blank')}
                            >
                                @clawdbot5449bot ile Bağlan
                            </Button>
                            <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
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
