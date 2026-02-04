'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import Link from 'next/link'
import { Users, Zap, BarChart3, Settings, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AdminStats {
    totalUsers: number
    activeUsers: number
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    averageCompletionTime: string
}

export default function AdminDashboard() {
    const { profile } = useAuthStore()
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin/stats')
                if (res.ok) {
                    const data = await res.json()
                    setStats(data)
                }
            } catch (error) {
                console.error('Stats fetch error:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    const adminCards = [
        {
            title: 'Kullanıcı Yönetimi',
            description: 'Kullanıcıları görüntüle ve yetkileri yönet',
            icon: Users,
            href: '/admin/users',
            color: 'from-blue-500 to-blue-600'
        },
        {
            title: 'Görev Yönetimi',
            description: 'Görevleri yönet, atama ve geri bildirim ver',
            icon: Zap,
            href: '/admin/tasks',
            color: 'from-purple-500 to-purple-600'
        },
        {
            title: 'Raporlar',
            description: 'Detaylı istatistikler ve analizler',
            icon: BarChart3,
            href: '/admin/reports',
            color: 'from-green-500 to-green-600'
        },
        {
            title: 'Ayarlar',
            description: 'Sistem ayarlarını ve rolleri yönet',
            icon: Settings,
            href: '/admin/settings',
            color: 'from-orange-500 to-orange-600'
        }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0e27] dark:to-[#111736] p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        Admin Paneli
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Merhaba, {profile?.full_name || 'Admin'}
                    </p>
                </div>

                {/* Stats Grid */}
                {!loading && stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {/* Total Users */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Kullanıcı</h3>
                                <Users className="h-5 w-5 text-blue-500" />
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">{stats.activeUsers} aktif</p>
                        </div>

                        {/* Total Tasks */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Görev</h3>
                                <Zap className="h-5 w-5 text-purple-500" />
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalTasks}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{stats.pendingTasks} beklemede</p>
                        </div>

                        {/* Completed Tasks */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Tamamlanan</h3>
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.completedTasks}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                %{stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}
                            </p>
                        </div>

                        {/* Completion Rate */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Ortalama Süre</h3>
                                <BarChart3 className="h-5 w-5 text-orange-500" />
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.averageCompletionTime}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">gün</p>
                        </div>
                    </div>
                )}

                {/* Admin Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {adminCards.map((card) => {
                        const IconComponent = card.icon
                        return (
                            <Link key={card.href} href={card.href}>
                                <div className="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow p-6 cursor-pointer group">
                                    <div className={`inline-block bg-gradient-to-br ${card.color} p-3 rounded-lg mb-4 group-hover:scale-110 transition-transform`}>
                                        <IconComponent className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        {card.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {card.description}
                                    </p>
                                    <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm group-hover:translate-x-1 transition-transform">
                                        Aç →
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {/* Quick Actions */}
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hızlı İşlemler</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button className="justify-center bg-blue-600 hover:bg-blue-700 text-white">
                            Yeni Kullanıcı Ekle
                        </Button>
                        <Button className="justify-center bg-purple-600 hover:bg-purple-700 text-white">
                            Sistem Logu Görüntüle
                        </Button>
                        <Button className="justify-center bg-orange-600 hover:bg-orange-700 text-white">
                            Yedek Oluştur
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
