'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus, Trash2, Search, Check, ListPlus, ClipboardPlus, UserCheck, Trash } from 'lucide-react'
import { Folder, FolderMember, Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { InitialsAvatar } from '@/components/ui/InitialsAvatar'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useTaskStore } from '@/store/useTaskStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/store/useAuthStore'

interface FolderMemberModalProps {
    folder: Folder
    isOpen: boolean
    onClose: () => void
}

interface NewMemberPermissions {
    can_add_task: boolean
    can_assign_task: boolean
    can_delete_task: boolean
    can_add_list: boolean
}

export default function FolderMemberModal({ folder, isOpen, onClose }: FolderMemberModalProps) {
    const { user, profile } = useAuthStore()
    const { folderMembers, fetchInitialData } = useTaskStore()
    const { showToast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Profile[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
    const [newMemberPermissions, setNewMemberPermissions] = useState<NewMemberPermissions>({
        can_add_task: true,
        can_assign_task: true,
        can_delete_task: false,
        can_add_list: false
    })

    const members = folderMembers.filter(m => m.folder_id === folder.id)
    const isOwner = folder.user_id === user?.id
    const isSuperAdmin = profile?.role === 'superadmin'
    const canDelete = isOwner || isSuperAdmin

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2) {
                searchUsers()
            } else {
                setSearchResults([])
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery])

    const searchUsers = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/profiles?q=${encodeURIComponent(searchQuery)}`)
            if (res.ok) {
                const data = await res.json()
                // Normalize keys - Oracle uppercase döndürüyor
                const normalized = data.map((p: any) => {
                    const n: any = {}
                    for (const k of Object.keys(p)) {
                        n[k.toLowerCase()] = p[k]
                    }
                    return n as Profile
                })
                setSearchResults(normalized)
            }
        } catch (e) {
            console.error('Search error:', e)
        }
        setIsLoading(false)
    }

    const handleAddMember = async (targetUser: Profile) => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/folder-members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folder_id: folder.id,
                    user_id: targetUser.id,
                    role: 'member',
                    can_add_task: newMemberPermissions.can_add_task,
                    can_assign_task: newMemberPermissions.can_assign_task,
                    can_delete_task: newMemberPermissions.can_delete_task,
                    can_add_list: newMemberPermissions.can_add_list
                })
            })

            if (!res.ok) {
                const err = await res.json()
                if (err.error?.includes('duplicate') || err.error?.includes('unique') || err.error?.includes('zaten')) {
                    showToast('Bu kullanıcı zaten bu departmanda bulunuyor.', 'info')
                } else {
                    showToast(`Hata: ${err.error}`, 'error')
                }
                return
            }

            showToast(`${targetUser.full_name || targetUser.email} eklendi`, 'success')
            setSearchQuery('')
            setSearchResults([])
            fetchInitialData()
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleRemoveMember = async (memberId: string) => {
        const res = await fetch(`/api/folder-members/${memberId}`, { method: 'DELETE' })

        if (!res.ok) {
            showToast('Üye çıkarılamadı', 'error')
        } else {
            showToast('Üye çıkarıldı', 'success')
            fetchInitialData()
        }
    }

    const handleUpdatePermission = async (memberId: string, field: keyof NewMemberPermissions, value: boolean) => {
        const res = await fetch(`/api/folder-members/${memberId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        })

        if (!res.ok) {
            showToast('Yetki güncellenemedi', 'error')
        } else {
            fetchInitialData()
        }
    }

    const PermissionCheckbox = ({ checked, onChange, label, icon: Icon }: { checked: boolean, onChange: () => void, label: string, icon: React.ElementType }) => (
        <button
            onClick={onChange}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${checked ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'}`}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {checked && <Check className="h-3 w-3" />}
        </button>
    )

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
            >
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold tracking-tight">{folder.title}</h3>
                            <p className="text-sm text-muted-foreground">Departman Üyelerini Yönet</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {isOwner && (
                        <div className="space-y-4 relative">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="İsim veya email ile ara..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Yeni üye için varsayılan yetkiler */}
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground">Yeni üye için yetkiler:</p>
                                <div className="flex flex-wrap gap-2">
                                    <PermissionCheckbox
                                        checked={newMemberPermissions.can_add_task}
                                        onChange={() => setNewMemberPermissions(p => ({ ...p, can_add_task: !p.can_add_task }))}
                                        label="Görev Ekle"
                                        icon={ClipboardPlus}
                                    />
                                    <PermissionCheckbox
                                        checked={newMemberPermissions.can_assign_task}
                                        onChange={() => setNewMemberPermissions(p => ({ ...p, can_assign_task: !p.can_assign_task }))}
                                        label="Atama Yap"
                                        icon={UserCheck}
                                    />
                                    <PermissionCheckbox
                                        checked={newMemberPermissions.can_delete_task}
                                        onChange={() => setNewMemberPermissions(p => ({ ...p, can_delete_task: !p.can_delete_task }))}
                                        label="Görev Sil"
                                        icon={Trash}
                                    />
                                    <PermissionCheckbox
                                        checked={newMemberPermissions.can_add_list}
                                        onChange={() => setNewMemberPermissions(p => ({ ...p, can_add_list: !p.can_add_list }))}
                                        label="Liste Ekle"
                                        icon={ListPlus}
                                    />
                                </div>
                            </div>

                            <AnimatePresence>
                                {searchResults.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-xl z-10 overflow-hidden"
                                        style={{ top: '140px' }}
                                    >
                                        {searchResults.map(profile => (
                                            <button
                                                key={profile.id}
                                                onClick={() => handleAddMember(profile)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left border-b last:border-none"
                                            >
                                                <InitialsAvatar
                                                    name={profile.full_name}
                                                    email={profile.email}
                                                    className="h-8 w-8 rounded-full text-primary"
                                                    textClassName="text-sm"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate">{profile.full_name || 'İsimsiz Kullanıcı'}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
                                                </div>
                                                <UserPlus className="h-4 w-4 text-primary" />
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Mevcut Üyeler ({members.length + 1})</h4>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                            {/* Sahibi */}
                            {(() => {
                                // Sahibin profilini bul
                                const ownerMember = folderMembers.find(m => m.folder_id === folder.id && m.user_id === folder.user_id)
                                // Eğer member listesinde yoksa (henüz yüklenmediyse) current user olabilir mi kontrol et
                                // Oracle ID'leri büyük harf olabilir, lower case kontrolü
                                const isCurrentUserOwner = folder.user_id === user?.id ||
                                    (user?.id && folder.user_id?.toLowerCase() === user.id.toLowerCase())

                                const ownerProfile = ownerMember?.profile || (isCurrentUserOwner ? profile : null)

                                return (
                                    <div className="flex items-center justify-between p-3 bg-accent/20 rounded-xl border border-accent/30">
                                        <div className="flex items-center gap-3">
                                            <InitialsAvatar
                                                name={ownerProfile?.full_name}
                                                email={ownerProfile?.email}
                                                className="h-8 w-8 rounded-full border border-primary/20"
                                                textClassName="text-sm"
                                            />
                                            <div>
                                                <p className="text-sm font-semibold">
                                                    {isCurrentUserOwner ? 'Sen (Sahibi)' : `${ownerProfile?.full_name || ownerProfile?.email || 'Bilinmeyen'} (Sahibi)`}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">Tüm yetkiler</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Üyeler */}
                            {members.map((member) => (
                                <div key={member.id} className="p-3 bg-muted/20 rounded-xl hover:bg-muted/30 transition-colors space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <InitialsAvatar
                                                name={member.profile?.full_name}
                                                email={member.profile?.email}
                                                className="h-8 w-8 rounded-full"
                                                textClassName="text-sm"
                                            />
                                            <div>
                                                <p className="text-sm font-semibold truncate max-w-[150px]">
                                                    {member.profile?.full_name || member.profile?.email}
                                                </p>
                                            </div>
                                        </div>
                                        {(isOwner || isSuperAdmin) && (
                                            <div className="flex items-center gap-1">
                                                {isOwner && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => setEditingMemberId(editingMemberId === member.id ? null : member.id)}
                                                    >
                                                        {editingMemberId === member.id ? 'Kapat' : 'Düzenle'}
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveMember(member.user_id)}
                                                        title={isSuperAdmin && !isOwner ? 'Superadmin silme yetkisi' : ''}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Yetki badge'leri - Oracle 0/1 döndürüyor, Boolean() ile kontrol et */}
                                    <div className="flex flex-wrap gap-1">
                                        {Boolean(member.can_add_task) && <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">Görev Ekle</span>}
                                        {Boolean(member.can_assign_task) && <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">Atama</span>}
                                        {Boolean(member.can_delete_task) && <span className="text-[10px] bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full">Silme</span>}
                                        {Boolean(member.can_add_list) && <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">Liste</span>}
                                    </div>

                                    {/* Yetki düzenleme paneli */}
                                    <AnimatePresence>
                                        {editingMemberId === member.id && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="flex flex-wrap gap-2 pt-2 border-t border-border/50"
                                            >
                                                <PermissionCheckbox
                                                    checked={Boolean(member.can_add_task)}
                                                    onChange={() => handleUpdatePermission(member.id, 'can_add_task', !member.can_add_task)}
                                                    label="Görev Ekle"
                                                    icon={ClipboardPlus}
                                                />
                                                <PermissionCheckbox
                                                    checked={Boolean(member.can_assign_task)}
                                                    onChange={() => handleUpdatePermission(member.id, 'can_assign_task', !member.can_assign_task)}
                                                    label="Atama"
                                                    icon={UserCheck}
                                                />
                                                <PermissionCheckbox
                                                    checked={Boolean(member.can_delete_task)}
                                                    onChange={() => handleUpdatePermission(member.id, 'can_delete_task', !member.can_delete_task)}
                                                    label="Silme"
                                                    icon={Trash}
                                                />
                                                <PermissionCheckbox
                                                    checked={Boolean(member.can_add_list)}
                                                    onChange={() => handleUpdatePermission(member.id, 'can_add_list', !member.can_add_list)}
                                                    label="Liste"
                                                    icon={ListPlus}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
