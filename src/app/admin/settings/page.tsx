'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'

interface FacilityOption {
    id: string
    code?: string
    name: string
    timezone?: string
    address?: string
    is_active?: number
}

interface DepartmentOption {
    id: string
    name: string
    category?: string
    facility_id: string
    facility_name?: string
    parent_id?: string
    is_active?: number
}

export default function SettingsPage() {
    const { showToast } = useToast()
    const [facilities, setFacilities] = useState<FacilityOption[]>([])
    const [departments, setDepartments] = useState<DepartmentOption[]>([])
    const [loading, setLoading] = useState(true)
    const [newFacilityName, setNewFacilityName] = useState('')
    const [newFacilityCode, setNewFacilityCode] = useState('')
    const [newDepartmentName, setNewDepartmentName] = useState('')
    const [newDepartmentCategory, setNewDepartmentCategory] = useState('')
    const [selectedFacilityId, setSelectedFacilityId] = useState('')

    const selectedFacilityDepartments = useMemo(() => {
        if (!selectedFacilityId) return departments
        return departments.filter((department) => department.facility_id === selectedFacilityId)
    }, [departments, selectedFacilityId])

    useEffect(() => {
        void fetchMasterData()
    }, [])

    const fetchMasterData = async () => {
        setLoading(true)
        try {
            const [facilitiesRes, departmentsRes] = await Promise.all([
                fetch('/api/org/facilities?include_inactive=1'),
                fetch('/api/org/departments?include_inactive=1')
            ])

            if (facilitiesRes.ok) {
                const facilitiesData = await facilitiesRes.json()
                const normalizedFacilities = Array.isArray(facilitiesData)
                    ? facilitiesData.map((item: any) => ({
                        id: item.id || item.ID,
                        code: item.code || item.CODE,
                        name: item.name || item.NAME,
                        timezone: item.timezone || item.TIMEZONE,
                        address: item.address || item.ADDRESS,
                        is_active: Number(item.is_active ?? item.IS_ACTIVE ?? 1)
                    }))
                    : []
                setFacilities(normalizedFacilities)

                if (!selectedFacilityId && normalizedFacilities.length > 0) {
                    setSelectedFacilityId(normalizedFacilities[0].id)
                }
            }

            if (departmentsRes.ok) {
                const departmentsData = await departmentsRes.json()
                const normalizedDepartments = Array.isArray(departmentsData)
                    ? departmentsData.map((item: any) => ({
                        id: item.id || item.ID,
                        name: item.name || item.NAME,
                        category: item.category || item.CATEGORY,
                        facility_id: item.facility_id || item.FACILITY_ID,
                        facility_name: item.facility_name || item.FACILITY_NAME,
                        parent_id: item.parent_id || item.PARENT_ID,
                        is_active: Number(item.is_active ?? item.IS_ACTIVE ?? 1)
                    }))
                    : []
                setDepartments(normalizedDepartments)
            }
        } catch (error) {
            console.error('Master data fetch error:', error)
            showToast('Master data yüklenemedi', 'error')
        } finally {
            setLoading(false)
        }
    }

    const createFacility = async () => {
        if (!newFacilityName.trim()) return
        try {
            const res = await fetch('/api/org/facilities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newFacilityName.trim(),
                    code: newFacilityCode.trim() || undefined
                })
            })

            if (!res.ok) {
                const err = await res.json()
                showToast(err.error || 'Şube eklenemedi', 'error')
                return
            }

            setNewFacilityName('')
            setNewFacilityCode('')
            showToast('Şube eklendi', 'success')
            await fetchMasterData()
        } catch (error) {
            console.error('Create facility error:', error)
            showToast('Şube eklenemedi', 'error')
        }
    }

    const renameFacility = async (facility: FacilityOption) => {
        const nextName = window.prompt('Yeni şube adı', facility.name)
        if (!nextName || nextName.trim() === facility.name) return

        const res = await fetch(`/api/org/facilities/${facility.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nextName.trim() })
        })

        if (!res.ok) {
            const err = await res.json()
            showToast(err.error || 'Şube güncellenemedi', 'error')
            return
        }

        showToast('Şube güncellendi', 'success')
        await fetchMasterData()
    }

    const deactivateFacility = async (facility: FacilityOption) => {
        if (!window.confirm(`${facility.name} şubesini pasife almak istiyor musunuz?`)) return

        const res = await fetch(`/api/org/facilities/${facility.id}`, {
            method: 'DELETE'
        })

        if (!res.ok) {
            const err = await res.json()
            showToast(err.error || 'Şube pasife alınamadı', 'error')
            return
        }

        showToast('Şube pasife alındı', 'success')
        await fetchMasterData()
    }

    const createDepartment = async () => {
        if (!newDepartmentName.trim() || !selectedFacilityId) return

        try {
            const res = await fetch('/api/org/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newDepartmentName.trim(),
                    facility_id: selectedFacilityId,
                    category: newDepartmentCategory.trim() || undefined
                })
            })

            if (!res.ok) {
                const err = await res.json()
                showToast(err.error || 'Departman eklenemedi', 'error')
                return
            }

            setNewDepartmentName('')
            setNewDepartmentCategory('')
            showToast('Departman eklendi', 'success')
            await fetchMasterData()
        } catch (error) {
            console.error('Create department error:', error)
            showToast('Departman eklenemedi', 'error')
        }
    }

    const renameDepartment = async (department: DepartmentOption) => {
        const nextName = window.prompt('Yeni departman adı', department.name)
        if (!nextName || nextName.trim() === department.name) return

        const res = await fetch(`/api/org/departments/${department.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nextName.trim() })
        })

        if (!res.ok) {
            const err = await res.json()
            showToast(err.error || 'Departman güncellenemedi', 'error')
            return
        }

        showToast('Departman güncellendi', 'success')
        await fetchMasterData()
    }

    const deactivateDepartment = async (department: DepartmentOption) => {
        if (!window.confirm(`${department.name} departmanını pasife almak istiyor musunuz?`)) return

        const res = await fetch(`/api/org/departments/${department.id}`, {
            method: 'DELETE'
        })

        if (!res.ok) {
            const err = await res.json()
            showToast(err.error || 'Departman pasife alınamadı', 'error')
            return
        }

        showToast('Departman pasife alındı', 'success')
        await fetchMasterData()
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0e27] dark:to-[#111736] p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Sistem Ayarları
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Sistem konfigürasyonunu, rol bilgilerini ve master data'yı yönet
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Şube Yönetimi
                        </h2>
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Input
                                    value={newFacilityName}
                                    onChange={(e) => setNewFacilityName(e.target.value)}
                                    placeholder="Yeni şube adı"
                                />
                                <Input
                                    value={newFacilityCode}
                                    onChange={(e) => setNewFacilityCode(e.target.value)}
                                    placeholder="Kod (opsiyonel)"
                                />
                            </div>
                            <Button onClick={createFacility} className="w-full">Şube Ekle</Button>

                            <div className="max-h-[360px] overflow-y-auto space-y-2">
                                {loading ? (
                                    <p className="text-sm text-gray-500">Yükleniyor...</p>
                                ) : facilities.length === 0 ? (
                                    <p className="text-sm text-gray-500">Henüz şube yok.</p>
                                ) : (
                                    facilities.map((facility) => (
                                        <div key={facility.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{facility.name}</p>
                                                <p className="text-xs text-gray-500">{facility.code || '-'} {facility.is_active === 0 ? '• Pasif' : ''}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => void renameFacility(facility)}>Düzenle</Button>
                                                {facility.is_active !== 0 && (
                                                    <Button variant="outline" size="sm" onClick={() => void deactivateFacility(facility)}>Pasife Al</Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Departman Yönetimi
                        </h2>
                        <div className="space-y-4">
                            <select
                                value={selectedFacilityId}
                                onChange={(e) => setSelectedFacilityId(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background"
                            >
                                <option value="">Şube Seçin</option>
                                {facilities.filter((facility) => facility.is_active !== 0).map((facility) => (
                                    <option key={facility.id} value={facility.id}>{facility.name}</option>
                                ))}
                            </select>

                            <Input
                                value={newDepartmentName}
                                onChange={(e) => setNewDepartmentName(e.target.value)}
                                placeholder="Yeni departman adı"
                                disabled={!selectedFacilityId}
                            />
                            <Input
                                value={newDepartmentCategory}
                                onChange={(e) => setNewDepartmentCategory(e.target.value)}
                                placeholder="Kategori (opsiyonel)"
                                disabled={!selectedFacilityId}
                            />
                            <Button onClick={createDepartment} className="w-full" disabled={!selectedFacilityId}>
                                Departman Ekle
                            </Button>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                {loading ? (
                                    <p className="text-sm text-gray-500">Yükleniyor...</p>
                                ) : selectedFacilityDepartments.length === 0 ? (
                                    <p className="text-sm text-gray-500">Bu filtrede departman yok.</p>
                                ) : (
                                    selectedFacilityDepartments.map((department) => (
                                        <div key={department.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{department.name}</p>
                                                <p className="text-xs text-gray-500">{department.facility_name || '-'} {department.category ? `• ${department.category}` : ''} {department.is_active === 0 ? '• Pasif' : ''}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => void renameDepartment(department)}>Düzenle</Button>
                                                {department.is_active !== 0 && (
                                                    <Button variant="outline" size="sm" onClick={() => void deactivateDepartment(department)}>Pasife Al</Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
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
