'use client'

import { useAuthStore } from '@/store/useAuthStore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Building2, Briefcase, Phone, User, Users } from 'lucide-react'

export default function OnboardingPage() {
    const { user, profile, setProfile } = useAuthStore()
    const router = useRouter()
    
    const [loading, setLoading] = useState(false)
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [formData, setFormData] = useState({
        full_name: '',
        department: '',
        branch: '',
        job_title: '',
        phone: '',
        manager_id: '',
        meeting_type: ''
    })

    useEffect(() => {
        if (!user) {
            router.push('/login')
            return
        }

        // Fetch all users for manager selection
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/profiles/all')
                if (res.ok) {
                    const data = await res.json()
                    setAllUsers(data.filter((u: any) => u.id !== user.id))
                }
            } catch (err) {
                console.error('Users fetch error:', err)
            }
        }

        fetchUsers()

        // Pre-fill with existing data
        if (profile) {
            setFormData({
                full_name: profile.full_name || user.name || '',
                department: profile.department || '',
                branch: profile.branch || '',
                job_title: profile.job_title || '',
                phone: profile.phone || '',
                manager_id: profile.manager_id || '',
                meeting_type: profile.meeting_type || ''
            })
        }
    }, [user, profile, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch('/api/profiles/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    is_profile_complete: 1
                })
            })

            if (!res.ok) {
                const err = await res.json()
                alert(err.error || 'Bir hata oluştu')
                return
            }

            const updatedProfile = await res.json()
            
            // Normalize profile keys
            const normalized: any = {}
            for (const key of Object.keys(updatedProfile)) {
                normalized[key.toLowerCase()] = updatedProfile[key]
            }
            
            setProfile(normalized)
            router.push('/')
        } catch (error) {
            console.error('Onboarding error:', error)
            alert('Bir hata oluştu')
        } finally {
            setLoading(false)
        }
    }

    const handleSkip = async () => {
        // Mark profile as complete even when skipping, so user won't see onboarding again
        try {
            await fetch('/api/profiles/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: user?.name || profile?.full_name || '',
                    department: profile?.department || 'Belirtilmemiş',
                    branch: profile?.branch || 'Genel',
                    job_title: profile?.job_title || 'Belirtilmemiş',
                    is_profile_complete: 1
                })
            })
        } catch (error) {
            console.error('Error marking profile complete:', error)
        }
        router.push('/')
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full mb-4">
                        <User className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Hoş Geldiniz!
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Lütfen profil bilgilerinizi tamamlayın
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Ad Soyad <span className="text-red-500">*</span>
                            </div>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                            placeholder="İsminizi girin"
                        />
                    </div>

                    {/* Job Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4" />
                                Ünvan <span className="text-red-500">*</span>
                            </div>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.job_title}
                            onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Ör: Yazılım Geliştirici, Doktor, Hemşire"
                        />
                    </div>

                    {/* Department */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Birim/Departman <span className="text-red-500">*</span>
                            </div>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.department}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Ör: Bilgi İşlem, Kalite, Ameliyathane"
                        />
                    </div>

                    {/* Branch */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Şube <span className="text-red-500">*</span>
                            </div>
                        </label>
                        <select
                            required
                            value={formData.branch}
                            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="">Şube seçin</option>
                            <option value="Çorlu Optimed Hastanesi">Çorlu Optimed Hastanesi</option>
                            <option value="Kapaklı Optimed Hastanesi">Kapaklı Optimed Hastanesi</option>
                            <option value="Çerkezköy Optimed">Çerkezköy Optimed</option>
                            <option value="Genel">Genel Merkez</option>
                        </select>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                Telefon
                            </div>
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                            placeholder="5XX XXX XX XX"
                        />
                    </div>

                    {/* Manager */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Yönetici
                            </div>
                        </label>
                        <select
                            value={formData.manager_id}
                            onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="">Yönetici seçin (isteğe bağlı)</option>
                            {allUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.full_name || u.email} {u.department && `(${u.department})`}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Meeting Type (for secretaries/admins) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Kurul Üyeliği
                            </div>
                        </label>
                        <input
                            type="text"
                            value={formData.meeting_type}
                            onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Ör: Kalite Kurulu, Yönetim Kurulu"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Birden fazla kurul için virgül ile ayırın
                        </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={handleSkip}
                            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Şimdi Değil
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Kaydediliyor...' : 'Devam Et'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
