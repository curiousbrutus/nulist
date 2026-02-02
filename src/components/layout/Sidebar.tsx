'use client'

import { useState, useEffect } from 'react'
import { Plus, Folder as FolderIcon, List as ListIcon, ChevronDown, ChevronRight, LogOut, Search, Settings, Trash2, Edit3, X as CloseIcon, Sun, Moon, Menu, Users, UserCheck, BarChart, Upload, Shield } from 'lucide-react'
import { InitialsAvatar } from '@/components/ui/InitialsAvatar'
import FolderMemberModal from './FolderMemberModal'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { useTaskStore } from '@/store/useTaskStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useThemeStore } from '@/store/useThemeStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { user, profile, setProfile, signOut } = useAuthStore()
    const {
        folders,
        lists,
        folderMembers,
        selectedListId,
        setSelectedListId,
        fetchInitialData,
        addFolder,
        deleteFolder,
        addList,
        deleteList,
        searchQuery,
        setSearchQuery
    } = useTaskStore()
    const { theme, toggleTheme } = useThemeStore()
    const { showToast } = useToast()
    const [isAddingFolder, setIsAddingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [isAddingList, setIsAddingList] = useState<string | null>(null)
    const [newListName, setNewListName] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<string[]>([])
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
    const [editingListId, setEditingListId] = useState<string | null>(null)
    const [managingFolderId, setManagingFolderId] = useState<string | null>(null)
    const [editText, setEditText] = useState('')
    const [sidebarWidth, setSidebarWidth] = useState(256) // 16rem * 16px = 256px
    const [isResizing, setIsResizing] = useState(false)
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', description: '', onConfirm: () => { } })

    // Handle sidebar resize
    useEffect(() => {
        if (!isResizing) return
        
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(200, Math.min(600, e.clientX))
            setSidebarWidth(newWidth)
        }
        
        const handleMouseUp = () => {
            setIsResizing(false)
            localStorage.setItem('sidebar-width', String(sidebarWidth))
        }
        
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, sidebarWidth])

    // Load saved sidebar width
    useEffect(() => {
        const saved = localStorage.getItem('sidebar-width')
        if (saved) {
            setSidebarWidth(Math.max(200, Math.min(600, parseInt(saved))))
        }
    }, [])

    useEffect(() => {
        const fetchProfile = async () => {
            if (user) {
                try {
                    const res = await fetch('/api/profiles/me')
                    if (res.ok) {
                        const data = await res.json()
                        // Normalize keys
                        const normalized: any = {}
                        for (const key of Object.keys(data)) {
                            normalized[key.toLowerCase()] = data[key]
                        }
                        // Always update profile to get latest role from DB
                        setProfile(normalized)
                    }
                } catch (e) {
                    console.error('Profile fetch error:', e)
                }
            }
        }

        if (user) {
            fetchInitialData()
            fetchProfile()
        }
    }, [user])

    const toggleFolder = (id: string) => {
        setExpandedFolders(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        )
    }

    const handleAddFolder = async () => {
        if (!newFolderName.trim()) {
            setIsAddingFolder(false)
            setNewFolderName('')
            return
        }

        await addFolder(newFolderName)
        setNewFolderName('')
        setIsAddingFolder(false)
    }

    const handleAddList = async (folderId: string) => {
        if (!newListName.trim()) {
            setIsAddingList(null)
            setNewListName('')
            return
        }

        await addList(newListName, folderId)
        setNewListName('')
        setIsAddingList(null)
    }

    const handleDeleteFolder = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Departmanı Sil',
            description: 'Bu departmanı ve içindeki tüm listeleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            onConfirm: async () => {
                await deleteFolder(id)
            }
        })
    }

    const handleDeleteList = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Listeyi Sil',
            description: 'Bu listeyi ve içindeki tüm görevleri silmek istediğinize emin misiniz?',
            onConfirm: async () => {
                await deleteList(id)
            }
        })
    }

    const handleRenameFolder = async (id: string) => {
        if (!editText.trim()) {
            setEditingFolderId(null)
            return
        }
        const res = await fetch(`/api/folders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: editText })
        })
        if (!res.ok) {
            showToast('Güncellenemedi', 'error')
        } else {
            fetchInitialData()
            setEditingFolderId(null)
        }
    }

    const handleRenameList = async (id: string) => {
        if (!editText.trim()) {
            setEditingListId(null)
            return
        }
        const res = await fetch(`/api/lists/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: editText })
        })
        if (!res.ok) {
            showToast('Güncellenemedi', 'error')
        } else {
            fetchInitialData()
            setEditingListId(null)
        }
    }

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            <aside 
                className={`fixed inset-y-0 left-0 z-50 border-r border-white/10 bg-gradient-to-b from-[#00205B] to-[#001233] text-white h-screen flex flex-col flex-shrink-0 select-none transition-transform duration-300 md:relative md:translate-x-0 shadow-2xl overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ width: `${sidebarWidth}px` }}
            >
                {/* Resize Handle */}
                <div
                    onMouseDown={() => setIsResizing(true)}
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-500/50 hover:w-1.5 transition-all duration-200 group md:block hidden"
                    title="Genişletmek için sürükleyin"
                />
                <div className="p-4 border-b border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {/* Logo Placeholder */}
                            <div className="h-8 w-8 bg-[#FF671F] rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                                <ListIcon className="h-5 w-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">Optimed</h2>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
                                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
                                <LogOut className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-white/70 md:hidden">
                                <CloseIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
                        <Input
                            placeholder="Ara..."
                            className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/10 focus:border-orange-500/50 transition-all font-light"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-2.5 text-white/50 hover:text-white"
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <div className="space-y-1">
                        <button
                            onClick={() => setSelectedListId('focus-today')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${selectedListId === 'focus-today' ? 'bg-[#FF671F] text-white shadow-lg shadow-orange-900/20 font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                        >
                            <Sun className={`h-4 w-4 ${selectedListId === 'focus-today' ? 'text-white' : 'text-orange-400'}`} />
                            Bugün
                        </button>
                        <button
                            onClick={() => setSelectedListId('my-tasks')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${selectedListId === 'my-tasks' ? 'bg-[#FF671F] text-white shadow-lg shadow-orange-900/20 font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                        >
                            <UserCheck className={`h-4 w-4 ${selectedListId === 'my-tasks' ? 'text-white' : 'text-emerald-400'}`} />
                            Bana Atananlar
                        </button>
                        <button
                            onClick={() => setSelectedListId(null)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${selectedListId === null ? 'bg-[#FF671F] text-white shadow-lg shadow-orange-900/20 font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                        >
                            <ListIcon className={`h-4 w-4 ${selectedListId === null ? 'text-white' : 'text-blue-400'}`} />
                            Tüm Görevler
                        </button>
                        <Link
                            href="/team"
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${selectedListId === 'team' ? 'bg-[#FF671F] text-white shadow-lg shadow-orange-900/20 font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                        >
                            <BarChart className="h-4 w-4 text-purple-400" />
                            Ekip Performansı
                        </Link>
                        {(profile?.role === 'secretary' || profile?.role === 'superadmin') && (
                            <Link
                                href="/settings/sync"
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${selectedListId === 'sync' ? 'bg-[#FF671F] text-white shadow-lg shadow-orange-900/20 font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                            >
                                <Shield className={`h-4 w-4 ${selectedListId === 'sync' ? 'text-white' : 'text-orange-400'}`} />
                                Birim Yönetimi
                            </Link>
                        )}
                        {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                            <>
                                {profile?.role === 'admin' && (
                                    <Link
                                        href="/import"
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 text-white/80 hover:bg-white/10 hover:text-white"
                                    >
                                        <Upload className="h-4 w-4 text-pink-400" />
                                        Toplu Görev Aktar
                                    </Link>
                                )}
                                <Link
                                    href="/admin"
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${selectedListId === 'admin' ? 'bg-[#FF671F] text-white shadow-lg shadow-orange-900/20 font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                                >
                                    <Shield className="h-4 w-4 text-red-400" />
                                    Admin Paneli
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                            Departmanlar
                            <button onClick={() => setIsAddingFolder(true)} className="hover:text-white text-white/60 transition-colors p-1 hover:bg-white/10 rounded">
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <div className="space-y-1">
                            {folders.filter(f => !f.parent_id).map((folder, fIndex) => (
                                <div key={folder.id || `folder-${fIndex}`} className="space-y-0.5">
                                    {/* Top Level Folder (Department) */}
                                    <div className="flex items-center group">
                                        <button
                                            onClick={() => toggleFolder(folder.id)}
                                            className="p-1 hover:bg-white/10 rounded-md text-white/60 transition-colors"
                                        >
                                            {expandedFolders.includes(folder.id) ? (
                                                <ChevronDown className="h-3 w-3" />
                                            ) : (
                                                <ChevronRight className="h-3 w-3" />
                                            )}
                                        </button>
                                        <div
                                            onClick={() => setSelectedListId(`folder-${folder.id}`)}
                                            className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-lg transition-all ${selectedListId === `folder-${folder.id}` ? 'bg-white/10 text-white font-medium' : 'text-white/80 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            <FolderIcon className="h-4 w-4 text-[#FF671F]" />
                                            {editingFolderId === folder.id ? (
                                                <Input
                                                    autoFocus
                                                    onFocus={(e) => e.target.select()}
                                                    className="h-6 text-xs p-1 bg-black/20 border-none text-white focus:ring-1 focus:ring-orange-500"
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    onBlur={() => handleRenameFolder(folder.id)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(folder.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span className="truncate flex-1 font-bold">{folder.title}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity px-1">
                                            <button
                                                onClick={() => setIsAddingList(`subfolder-${folder.id}`)}
                                                className="p-1 hover:bg-white/20 rounded text-white/70 hover:text-blue-400"
                                                title="Birim Ekle"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Add Subfolder/Unit Input */}
                                    {isAddingList === `subfolder-${folder.id}` && (
                                        <div className="ml-8 mr-2 py-1">
                                            <Input
                                                autoFocus
                                                className="h-7 text-xs bg-black/20 border-white/10 text-white"
                                                placeholder="Birim adı..."
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter') {
                                                        await addFolder((e.target as HTMLInputElement).value, folder.id)
                                                        setIsAddingList(null)
                                                    } else if (e.key === 'Escape') {
                                                        setIsAddingList(null)
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Subfolders (Units) */}
                                    {expandedFolders.includes(folder.id) && (
                                        <div className="ml-4 space-y-1 border-l border-white/5 pl-2 mt-1">
                                            {folders.filter(sf => sf.parent_id === folder.id).map((subFolder) => (
                                                <div key={subFolder.id} className="space-y-0.5">
                                                    <div className="flex items-center group">
                                                        <button
                                                            onClick={() => toggleFolder(subFolder.id)}
                                                            className="p-1 hover:bg-white/10 rounded-md text-white/40 transition-colors"
                                                        >
                                                            {expandedFolders.includes(subFolder.id) ? (
                                                                <ChevronDown className="h-2.5 w-2.5" />
                                                            ) : (
                                                                <ChevronRight className="h-2.5 w-2.5" />
                                                            )}
                                                        </button>
                                                        <div
                                                            onClick={() => setSelectedListId(`folder-${subFolder.id}`)}
                                                            className={`flex-1 flex items-center gap-2 px-2 py-1 text-xs cursor-pointer rounded-lg transition-all ${selectedListId === `folder-${subFolder.id}` ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                                        >
                                                            <FolderIcon className="h-3.5 w-3.5 text-blue-400/70" />
                                                            {editingFolderId === subFolder.id ? (
                                                                <Input
                                                                    autoFocus
                                                                    onFocus={(e) => e.target.select()}
                                                                    className="h-5 text-[10px] p-1 bg-black/20 border-none text-white focus:ring-1 focus:ring-orange-500"
                                                                    value={editText}
                                                                    onChange={(e) => setEditText(e.target.value)}
                                                                    onBlur={() => handleRenameFolder(subFolder.id)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(subFolder.id)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            ) : (
                                                                <span className="truncate flex-1">{subFolder.title}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setEditingFolderId(subFolder.id)
                                                                    setEditText(subFolder.title)
                                                                }}
                                                                className="p-1 hover:bg-white/20 rounded text-white/40 hover:text-white"
                                                            >
                                                                <Edit3 className="h-2.5 w-2.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setIsAddingList(`list-${subFolder.id}`)}
                                                                className="p-1 hover:bg-white/20 rounded text-white/40 hover:text-blue-400"
                                                                title="Liste Ekle"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Add List to Unit Input */}
                                                    {isAddingList === `list-${subFolder.id}` && (
                                                        <div className="ml-6 mr-2 py-1">
                                                            <Input
                                                                autoFocus
                                                                className="h-6 text-[10px] bg-black/20 border-white/10 text-white"
                                                                placeholder="Liste/Toplantı adı..."
                                                                onKeyDown={async (e) => {
                                                                    if (e.key === 'Enter') {
                                                                        await addList((e.target as HTMLInputElement).value, subFolder.id)
                                                                        setIsAddingList(null)
                                                                    } else if (e.key === 'Escape') {
                                                                        setIsAddingList(null)
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Lists under Unit */}
                                                    {expandedFolders.includes(subFolder.id) && (
                                                        <div className="ml-4 space-y-0.5 border-l border-white/5 pl-2 mt-0.5">
                                                            {lists.filter(l => l.folder_id === subFolder.id).map((list) => (
                                                                <div key={list.id} className="group/list relative flex items-center">
                                                                    <button
                                                                        onClick={() => setSelectedListId(list.id)}
                                                                        className={`flex-1 text-left px-2 py-1 rounded-md text-[11px] font-light truncate transition-colors ${selectedListId === list.id ? 'bg-[#FF671F]/20 text-white pointer-events-none' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                                                                    >
                                                                        {editingListId === list.id ? (
                                                                            <Input
                                                                                autoFocus
                                                                                onFocus={(e) => e.target.select()}
                                                                                className="h-5 text-[10px] p-0.5 bg-black/20 border-none text-white focus:ring-0"
                                                                                value={editText}
                                                                                onChange={(e) => setEditText(e.target.value)}
                                                                                onBlur={() => handleRenameList(list.id)}
                                                                                onKeyDown={(e) => e.key === 'Enter' && handleRenameList(list.id)}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            />
                                                                        ) : (
                                                                            list.title
                                                                        )}
                                                                    </button>
                                                                    {!editingListId && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setEditingListId(list.id)
                                                                                setEditText(list.title)
                                                                            }}
                                                                            className="absolute right-1 opacity-0 group-hover/list:opacity-100 p-1 hover:bg-white/20 rounded text-white/30 hover:text-white"
                                                                        >
                                                                            <Edit3 className="h-2 w-2" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isAddingFolder && (
                                <div className="px-2 py-1">
                                    <Input
                                        autoFocus
                                        className="h-8 text-sm bg-black/20 border-white/10 text-white placeholder:text-white/30"
                                        placeholder="Departman adı..."
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                handleAddFolder()
                                            } else if (e.key === 'Escape') {
                                                setIsAddingFolder(false)
                                                setNewFolderName('')
                                            }
                                        }}
                                        onBlur={() => {
                                            if (!newFolderName.trim()) {
                                                setIsAddingFolder(false)
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </nav>

                <div className="p-4 border-t border-white/10 bg-[#001233]/50 backdrop-blur-md">
                    <Link
                        href="/settings/profile"
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 transition-all group"
                    >
                        <InitialsAvatar
                            name={profile?.full_name}
                            email={user?.email}
                            className="h-9 w-9 rounded-full ring-2 ring-white/10 shadow-lg"
                            textClassName="text-sm"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-white group-hover:text-orange-300 transition-colors">
                                {profile?.full_name || 'Kullanıcı'}
                            </p>
                            <p className="text-[10px] text-white/50 truncate">{user?.email}</p>
                        </div>
                        <Settings className="h-4 w-4 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                </div>
            </aside>

            <ConfirmDialog
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                description={confirmConfig.description}
                onConfirm={confirmConfig.onConfirm}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
            />
            {managingFolderId && (
                <FolderMemberModal
                    folder={folders.find(f => f.id === managingFolderId)!}
                    isOpen={!!managingFolderId}
                    onClose={() => setManagingFolderId(null)}
                />
            )}
        </>
    )
}
