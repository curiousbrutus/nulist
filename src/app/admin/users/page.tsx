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

    const roles = [
        { value: 'user', label: 'Kullanıcı', color: 'bg-gray-500' },
        { value: 'secretary', label: 'Sekreter', color: 'bg-blue-500' },
        { value: 'admin', label: 'Admin', color: 'bg-purple-500' },
        { value: 'superadmin', label: 'Süper Admin', color: 'bg-red-500' }
    ] as const

    useEffect(() => {
        fetchUsers()
    }, [])

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

    const handleStartEdit = (user: UserWithProfile) => {
        setEditingUserId(user.id)
        setEditName(user.full_name || '')
        setEditEmail(user.email || '')
        setSelectedRole((user.role as any) || 'user')
    }

    const handleSaveUser = async (userId: string) => {
        try {
            const currentUser = users.find(u => u.id === userId)
            const updates: Record<string, string> = {}

            if (editName !== (currentUser?.full_name || '')) updates.full_name = editName
            if (editEmail !== (currentUser?.email || '')) updates.email = editEmail
            if (selectedRole !== (currentUser?.role || 'user')) updates.role = selectedRole

            if (Object.keys(updates).length === 0) {
                setEditingUserId(null)
                return
            }

            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            })
            if (res.ok) {
                showToast('Kullanıcı güncellendi', 'success')
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
                                                    <select
                                                        value={selectedRole}
                                                        onChange={(e) => setSelectedRole(e.target.value as any)}
                                                        className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-medium border border-gray-300 dark:border-gray-600"
                                                    >
                                                        {roles.map(role => (
                                                            <option key={role.value} value={role.value}>
                                                                {role.label}
                                                            </option>
                                                        ))}
                                                    </select>
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
                                                                onClick={() => handleStartEdit(user)}
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
