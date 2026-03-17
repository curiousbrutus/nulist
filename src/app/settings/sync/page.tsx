'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, RefreshCw } from 'lucide-react'

interface Facility {
    id: string
    name: string
    code: string
    is_active: number
}

interface Department {
    id: string
    facility_id: string
    facility_name: string
    name: string
    code: string
    is_active: number
}

interface AssignmentResponse {
    facility_ids: string[]
    department_ids: string[]
}

interface AssignmentPayload {
    facility_ids: string[]
    department_ids: string[]
}

export default function UnitManagementPage() {
    const { profile } = useAuthStore()
    const [facilities, setFacilities] = useState<Facility[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])
    const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([])
    const [facilityToAdd, setFacilityToAdd] = useState('')
    const [departmentToAdd, setDepartmentToAdd] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const { showToast } = useToast()
    const router = useRouter()

    useEffect(() => {
        if (!profile) {
            return
        }

        fetchData()
    }, [profile])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [facilitiesRes, departmentsRes, assignmentsRes] = await Promise.all([
                fetch('/api/org/facilities?includeInactive=0'),
                fetch('/api/org/departments?activeOnly=1'),
                fetch('/api/org/assignments')
            ])

            if (!facilitiesRes.ok || !departmentsRes.ok || !assignmentsRes.ok) {
                throw new Error('Birim bilgileri yüklenemedi')
            }

            const facilitiesData = await facilitiesRes.json() as Facility[]
            const departmentsData = await departmentsRes.json() as Department[]
            const assignmentData = await assignmentsRes.json() as AssignmentResponse

            setFacilities(facilitiesData)
            setDepartments(departmentsData)

            const normalizedFacilityIds = Array.isArray(assignmentData.facility_ids)
                ? assignmentData.facility_ids.map((id) => String(id))
                : []

            const normalizedDepartmentIds = Array.isArray(assignmentData.department_ids)
                ? assignmentData.department_ids.map((id) => String(id))
                : []

            if (normalizedFacilityIds.length === 0 && profile?.branch) {
                const matchedFacility = facilitiesData.find((item) => item.name === profile.branch)
                if (matchedFacility) {
                    normalizedFacilityIds.push(matchedFacility.id)
                }
            }

            setSelectedFacilityIds(Array.from(new Set(normalizedFacilityIds)))
            setSelectedDepartmentIds(Array.from(new Set(normalizedDepartmentIds)))
        } catch (e) {
            showToast('Birim bilgileri alınamadı', 'error')
        } finally {
            setLoading(false)
        }
    }

    const saveAssignments = async () => {
        setSaving(true)
        try {
            const payload: AssignmentPayload = {
                facility_ids: selectedFacilityIds,
                department_ids: selectedDepartmentIds
            }

            const res = await fetch('/api/org/assignments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                showToast('Birim atamalarınız güncellendi', 'success')
                await fetchData()
            } else {
                const errorData = await res.json().catch(() => ({}))
                showToast(errorData.error || 'Güncelleme yapılamadı', 'error')
            }
        } catch (e) {
            showToast('Sistem hatası', 'error')
        } finally {
            setSaving(false)
        }
    }

    if (!profile) {
        return null
    }

    const availableFacilities = facilities.filter((facility) => !selectedFacilityIds.includes(facility.id))
    const selectedFacilities = facilities.filter((facility) => selectedFacilityIds.includes(facility.id))
    const departmentOptions = departments.filter((departmentOption) => selectedFacilityIds.includes(departmentOption.facility_id))
    const availableDepartments = departmentOptions.filter((departmentOption) => !selectedDepartmentIds.includes(departmentOption.id))
    const selectedDepartments = departments.filter((departmentOption) => selectedDepartmentIds.includes(departmentOption.id))
    const departmentsByFacility = facilities.map((facility) => ({
        ...facility,
        departments: departments.filter((departmentOption) => departmentOption.facility_id === facility.id)
    }))

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 text-foreground">
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">Kendi Birim Yönetimim</h1>
                            <p className="text-sm text-muted-foreground">Çalıştığınız şube ve departman atamalarınızı yönetin.</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading || saving}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Yenile
                    </Button>
                </header>

                <div className="bg-card border rounded-2xl p-4 md:p-6 space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Bağlı Olduğum Şubeler</label>
                        <div className="flex flex-col md:flex-row gap-2">
                            <select
                                value={facilityToAdd}
                                onChange={(event) => setFacilityToAdd(event.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background"
                                disabled={loading || saving}
                            >
                                <option value="">{loading ? 'Yükleniyor...' : 'Şube seçin'}</option>
                                {availableFacilities.map((facility) => (
                                    <option key={facility.id} value={facility.id}>{facility.name}</option>
                                ))}
                            </select>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!facilityToAdd || loading || saving}
                                onClick={() => {
                                    if (!facilityToAdd) return
                                    setSelectedFacilityIds((prev) => [...prev, facilityToAdd])
                                    setFacilityToAdd('')
                                }}
                            >
                                Ekle
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {selectedFacilities.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Henüz şube seçmediniz.</p>
                            ) : (
                                selectedFacilities.map((facility) => (
                                    <div key={facility.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <p className="text-sm font-medium">{facility.name}</p>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            disabled={loading || saving}
                                            onClick={() => {
                                                setSelectedFacilityIds((prev) => prev.filter((id) => id !== facility.id))
                                                setSelectedDepartmentIds((prev) => prev.filter((departmentId) => {
                                                    const departmentOption = departments.find((item) => item.id === departmentId)
                                                    return departmentOption?.facility_id !== facility.id
                                                }))
                                            }}
                                        >
                                            Kaldır
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium">Bağlı Olduğum Departmanlar</label>
                        <div className="flex flex-col md:flex-row gap-2">
                            <select
                                value={departmentToAdd}
                                onChange={(event) => setDepartmentToAdd(event.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background"
                                disabled={loading || saving}
                            >
                                <option value="">{loading ? 'Yükleniyor...' : 'Departman seçin'}</option>
                                {availableDepartments.map((departmentOption) => (
                                    <option key={departmentOption.id} value={departmentOption.id}>
                                        {departmentOption.name} {departmentOption.facility_name ? `(${departmentOption.facility_name})` : ''}
                                    </option>
                                ))}
                            </select>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!departmentToAdd || loading || saving}
                                onClick={() => {
                                    if (!departmentToAdd) return
                                    setSelectedDepartmentIds((prev) => [...prev, departmentToAdd])
                                    setDepartmentToAdd('')
                                }}
                            >
                                Ekle
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {selectedDepartments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Henüz departman seçmediniz.</p>
                            ) : (
                                selectedDepartments.map((departmentOption) => (
                                    <div key={departmentOption.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">{departmentOption.name}</p>
                                            <p className="text-xs text-muted-foreground">{departmentOption.facility_name || '-'}</p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            disabled={loading || saving}
                                            onClick={() => setSelectedDepartmentIds((prev) => prev.filter((id) => id !== departmentOption.id))}
                                        >
                                            Kaldır
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" disabled={loading || saving} onClick={fetchData}>İptal</Button>
                        <Button variant="primary" disabled={loading || saving} onClick={saveAssignments}>
                            {saving ? 'Kaydediliyor...' : 'Atamaları Kaydet'}
                        </Button>
                    </div>
                </div>

                <div className="bg-card border rounded-2xl p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-base font-semibold">Sistemdeki Aktif Birimler</h2>
                        <p className="text-sm text-muted-foreground">
                            Toplam {facilities.length} şube, {departments.length} departman listelendi.
                        </p>
                    </div>

                    <div className="space-y-3 max-h-72 overflow-auto pr-1">
                        {departmentsByFacility.map((facility) => (
                            <div key={facility.id} className="rounded-md border p-3">
                                <p className="text-sm font-medium">{facility.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {facility.departments.length > 0
                                        ? facility.departments.map((item) => item.name).join(', ')
                                        : 'Bu şubede aktif departman bulunmuyor.'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
