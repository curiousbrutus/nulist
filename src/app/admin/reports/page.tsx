'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ReportsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0e27] dark:to-[#111736] p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Raporlar
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Detaylı istatistikler ve analizler
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            Kullanıcı Performansı
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Kullanıcıların görev tamamlama oranlarını ve performansını görüntüle
                        </p>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            Raporu Görüntüle
                        </Button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            Görev Analitiği
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Görevlerin kategori, öncelik ve durum bazında dağılımını görüntüle
                        </p>
                        <Button className="bg-purple-600 hover:bg-purple-700">
                            Raporu Görüntüle
                        </Button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            Şube Performansı
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Şubeler arasında görev tamamlama oranlarını karşılaştır
                        </p>
                        <Button className="bg-green-600 hover:bg-green-700">
                            Raporu Görüntüle
                        </Button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            Sistem Logları
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Tüm sistem etkinliklerini ve değişiklikleri görüntüle
                        </p>
                        <Button className="bg-orange-600 hover:bg-orange-700">
                            Raporu Görüntüle
                        </Button>
                    </div>
                </div>

                <div className="mt-8">
                    <Link href="/admin">
                        <Button variant="outline" className="gap-2">
                            ← Admin Paneline Dön
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
