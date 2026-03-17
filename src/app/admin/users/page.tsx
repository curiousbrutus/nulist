'use client'

import { useState, useEffect } from 'react'
import { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Shield, Trash2, Edit2, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/useAuthStore'

interface UserWithProfile extends Profile {
    last_login?: string
    task_count?: number
    created_at?: string
}

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

export default function UsersManagement() {
    const { profile: adminProfile } = useAuthStore()
    const { showToast } = useToast()
    const [users, setUsers] = useState<UserWithProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingUserId, setEditingUserId] = useState<string | null>(null)
    const [selectedRole, setSelectedRole] = useState<'user' | 'admin' | 'secretary' | 'superadmin'>('user')
    const [editName, setEditName] = useState('')
    const [editEmail, setEditEmail] = useState('')
    const [facilities, setFacilities] = useState<FacilityOption[]>([])
    const [departments, setDepartments] = useState<DepartmentOption[]>([])
    const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])
    const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([])
    const [facilityToAdd, setFacilityToAdd] = useState('')
    const [departmentToAdd, setDepartmentToAdd] = useState('')

    const roles = [
        { value: 'user', label: 'Kullanıcı', color: 'bg-gray-500' },
        { value: 'secretary', label: 'Sekreter', color: 'bg-blue-500' },
        { value: 'admin', label: 'Admin', color: 'bg-purple-500' },
        { value: 'superadmin', label: 'Süper Admin', color: 'bg-red-500' }
    ] as const

    useEffect(() => {
        fetchUsers()
        fetchOrgOptions()
    }, [])

    const fetchOrgOptions = async () => {
        try {
            const [facilitiesRes, departmentsRes] = await Promise.all([
                fetch('/api/org/facilities'),
                fetch('/api/org/departments')
            ])

            if (facilitiesRes.ok) {
                const data = await facilitiesRes.json()
                const normalized = Array.isArray(data)
                    ? data
                        .map((item: any) => ({
                            id: item.id || item.ID,
                            name: item.name || item.NAME
                        }))
                        .filter((item: FacilityOption) => Boolean(item.id && item.name))
                    : []
                setFacilities(normalized)
            }

            if (departmentsRes.ok) {
                const data = await departmentsRes.json()
                const normalized = Array.isArray(data)
                    ? data
                        .map((item: any) => ({
                            id: item.id || item.ID,
                            name: item.name || item.NAME,
                            facility_id: item.facility_id || item.FACILITY_ID,
                            facility_name: item.facility_name || item.FACILITY_NAME
                        }))
                        .filter((item: DepartmentOption) => Boolean(item.id && item.name && item.facility_id))
                    : []
                setDepartments(normalized)
            }
        } catch (error) {
            console.error('Fetch org options error:', error)
        }
    }

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users')
            if (res.ok) {
                const data = await res.json()
                setUsers(data)
            }
        } catch (error) {
            console.error('Fetch users error:', error)
            showToast('Kullanıcılar yüklenemedi', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleStartEdit = async (user: UserWithProfile) => {
        setEditingUserId(user.id)
        setEditName(user.full_name || '')
        setEditEmail(user.email || '')
        setSelectedRole((user.role as any) || 'user')
        setSelectedFacilityIds([])
        setSelectedDepartmentIds([])
        setFacilityToAdd('')
        setDepartmentToAdd('')

        try {
            const res = await fetch(`/api/org/assignments?user_id=${encodeURIComponent(user.id)}`)
            if (res.ok) {
                const data = await res.json()
                setSelectedFacilityIds(Array.isArray(data?.facility_ids) ? data.facility_ids : [])
                setSelectedDepartmentIds(Array.isArray(data?.department_ids) ? data.department_ids : [])
            }
        } catch (error) {
            console.error('Load user assignments error:', error)
        }
    }

    const handleSaveUser = async (userId: string) => {
        try {
            const currentUser = users.find(u => u.id === userId)
            const updates: Record<string, string> = {}

            if (editName !== (currentUser?.full_name || '')) updates.full_name = editName
            if (editEmail !== (currentUser?.email || '')) updates.email = editEmail
            if (selectedRole !== (currentUser?.role || 'user')) updates.role = selectedRole

            let userUpdateOk = true
            let userUpdateSkipped = false

            if (Object.keys(updates).length > 0) {
                const res = await fetch(`/api/admin/users/${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                })
                userUpdateOk = res.ok
            } else {
                userUpdateSkipped = true
            }

            const assignmentRes = await fetch('/api/org/assignments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    facility_ids: selectedFacilityIds,
                    department_ids: selectedDepartmentIds
                })
            })

            if (userUpdateOk && assignmentRes.ok) {
                showToast(userUpdateSkipped ? 'Atamalar güncellendi' : 'Kullanıcı güncellendi', 'success')
                setEditingUserId(null)
                fetchUsers()
            } else if (userUpdateOk && !assignmentRes.ok) {
                showToast('Kullanıcı güncellendi, atamalar güncellenemedi', 'error')
                setEditingUserId(null)
                fetchUsers()
            } else {
                showToast('Kullanıcı güncellenemedi', 'error')
            }
        } catch (error) {
            console.error('Update user error:', error)
            showToast('Hata oluştu', 'error')
        }
    }

    const handleDeleteUser = async (userId: string, userName: string) => {
        if (confirm(`${userName} kullanıcısını silmek istediğinize emin misiniz?`)) {
            try {
                const res = await fetch(`/api/admin/users/${userId}`, {
                    method: 'DELETE'
                })
                if (res.ok) {
                    showToast('Kullanıcı silindi', 'success')
                    fetchUsers()
                } else {
                    showToast('Kullanıcı silinemedi', 'error')
                }
            } catch (error) {
                console.error('Delete user error:', error)
                showToast('Hata oluştu', 'error')
            }
        }
    }

    const filteredUsers = users.filter(user =>
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const availableFacilities = facilities.filter((facility) => !selectedFacilityIds.includes(facility.id))
    const selectedFacilities = facilities.filter((facility) => selectedFacilityIds.includes(facility.id))
    const filteredDepartmentOptions = departments.filter((department) => selectedFacilityIds.includes(department.facility_id))
    const availableDepartments = filteredDepartmentOptions.filter((department) => !selectedDepartmentIds.includes(department.id))
    const selectedDepartments = departments.filter((department) => selectedDepartmentIds.includes(department.id))

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0e27] dark:to-[#111736] p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Kullanıcı Yönetimi
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Tüm kullanıcıları görüntüle ve yetkileri yönet
                    </p>
                </div>

                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                            placeholder="Kullanıcı adı veya e-posta ile ara..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                        Kullanıcı
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                        E-posta
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                        Rol
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                        Görev Sayısı
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                        Şube
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                        İşlemler
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                            Yükleniyor...
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                            Kullanıcı bulunamadı
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4">
                                                {editingUserId === user.id ? (
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="h-8 text-sm"
                                                        placeholder="Ad Soyad"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {user.full_name || 'N/A'}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingUserId === user.id ? (
                                                    <Input
                                                        value={editEmail}
                                                        onChange={(e) => setEditEmail(e.target.value)}
                                                        className="h-8 text-sm"
                                                        placeholder="E-posta"
                                                    />
                                                ) : (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        {user.email}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingUserId === user.id ? (
                                                    <div className="space-y-2 min-w-[260px]">
                                                        <select
                                                            value={selectedRole}
                                                            onChange={(e) => setSelectedRole(e.target.value as any)}
                                                            className="w-full px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-medium border border-gray-300 dark:border-gray-600"
                                                        >
                                                            {roles.map(role => (
                                                                <option key={role.value} value={role.value}>
                                                                    {role.label}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        <div className="space-y-1">
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Şube Atamaları</p>
                                                            <div className="flex gap-1.5">
                                                                <select
                                                                    value={facilityToAdd}
                                                                    onChange={(e) => setFacilityToAdd(e.target.value)}
                                                                    className="w-full px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs border border-gray-300 dark:border-gray-600"
                                                                >
                                                                    <option value="">Şube seçin</option>
                                                                    {availableFacilities.map((facility) => (
                                                                        <option key={facility.id} value={facility.id}>{facility.name}</option>
                                                                    ))}
                                                                </select>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={!facilityToAdd}
                                                                    onClick={() => {
                                                                        if (!facilityToAdd) return
                                                                        setSelectedFacilityIds((prev) => [...prev, facilityToAdd])
                                                                        setFacilityToAdd('')
                                                                    }}
                                                                >+
                                                                </Button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {selectedFacilities.map((facility) => (
                                                                    <button
                                                                        key={facility.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedFacilityIds((prev) => prev.filter((id) => id !== facility.id))
                                                                            setSelectedDepartmentIds((prev) => prev.filter((departmentId) => {
                                                                                const match = departments.find((department) => department.id === departmentId)
                                                                                return match?.facility_id !== facility.id
                                                                            }))
                                                                        }}
                                                                        className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                                                    >
                                                                        {facility.name} ×
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Departman Atamaları</p>
                                                            <div className="flex gap-1.5">
                                                                <select
                                                                    value={departmentToAdd}
                                                                    onChange={(e) => setDepartmentToAdd(e.target.value)}
                                                                    className="w-full px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs border border-gray-300 dark:border-gray-600"
                                                                >
                                                                    <option value="">Departman seçin</option>
                                                                    {availableDepartments.map((department) => (
                                                                        <option key={department.id} value={department.id}>
                                                                            {department.name} {department.facility_name ? `(${department.facility_name})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={!departmentToAdd}
                                                                    onClick={() => {
                                                                        if (!departmentToAdd) return
                                                                        setSelectedDepartmentIds((prev) => [...prev, departmentToAdd])
                                                                        setDepartmentToAdd('')
                                                                    }}
                                                                >+
                                                                </Button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {selectedDepartments.map((department) => (
                                                                    <button
                                                                        key={department.id}
                                                                        type="button"
                                                                        onClick={() => setSelectedDepartmentIds((prev) => prev.filter((id) => id !== department.id))}
                                                                        className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
                                                                    >
                                                                        {department.name} ×
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Shield className="h-4 w-4" />
                                                        <span className="text-sm font-medium">
                                                            {roles.find(r => r.value === user.role)?.label || 'Kullanıcı'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {user.task_count || 0}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {user.branch || 'N/A'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {editingUserId === user.id ? (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleSaveUser(user.id)}
                                                                className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setEditingUserId(null)}
                                                                className="h-8 w-8 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => void handleStartEdit(user)}
                                                                className="h-8 w-8 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            {adminProfile?.role?.match(/^(superadmin|admin)$/) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteUser(user.id, user.full_name || user.email)}
                                                                    className="h-8 w-8 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-900 dark:text-blue-200">
                        <strong>İpucu:</strong> Kullanıcı rollerini düzenlemek için satırda Edit butonuna tıklayın. Silme işlemi sadece Süper Admin tarafından yapılabilir.
                    </p>
                </div>
            </div>
        </div>
    )
}
