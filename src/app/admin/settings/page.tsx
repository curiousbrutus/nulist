'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function SettingsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0e27] dark:to-[#111736] p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Sistem Ayarları
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Sistem konfigürasyonunu ve rolleri yönet
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Rol Tanımları
                        </h2>
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                                    Kullanıcı (User)
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Temel görev oluşturma ve yönetim izinleri
                                </p>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                                    Sekreter (Secretary)
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Ekip görevlerini filtrele ve dışa aktar
                                </p>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                                    Admin
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Görevleri yönet ve geri bildirim ver
                                </p>
                            </div>

                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                                    Süper Admin (Superadmin)
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Tüm sistem yetkilerine sahip, kullanıcı yönetimi ve silme
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Sistem Bilgileri
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Veritabanı</p>
                                <p className="text-gray-900 dark:text-white font-medium">Oracle Database</p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Dil</p>
                                <p className="text-gray-900 dark:text-white font-medium">Türkçe</p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">API Versiyonu</p>
                                <p className="text-gray-900 dark:text-white font-medium">v1.0</p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Güvenlik</p>
                                <p className="text-gray-900 dark:text-white font-medium">VPD (Row-Level Security) Aktif</p>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                                İşlemler
                            </h3>
                            <div className="space-y-2">
                                <Button className="w-full bg-blue-600 hover:bg-blue-700 justify-center">
                                    Yedek Oluştur
                                </Button>
                                <Button className="w-full bg-orange-600 hover:bg-orange-700 justify-center">
                                    Sistem Loglarını İndir
                                </Button>
                            </div>
                        </div>
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
