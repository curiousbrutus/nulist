import { X, Calendar, Star, Trash2, CheckCircle2, Circle, AlertTriangle, AlertOctagon, Flag, List as ListIcon, MessageSquare, Send, User as UserIcon, Paperclip, Search, Plus } from 'lucide-react'
import { Task, Profile, Comment } from '@/types/database'
import { clsx } from 'clsx'
import { useTaskStore } from '@/store/useTaskStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/toast'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/useAuthStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/input'
import FileUpload from '@/components/tasks/FileUpload'
import AttachmentList from '@/components/tasks/AttachmentList'
import { InitialsAvatar } from '@/components/ui/InitialsAvatar'

interface TaskDetailProps {
    task: Task | null
    onClose: () => void
}

export default function TaskDetail({ task: initialTask, onClose }: TaskDetailProps) {
    const { user, profile } = useAuthStore()
    const { tasks, toggleTask, deleteTask, updateTask, folders, lists, folderMembers, assignTask, unassignTask, toggleAssigneeCompletion, addComment, deleteAttachment, refreshTaskAttachments } = useTaskStore()
    const { showToast } = useToast()

    // Store'dan güncel task'ı bul (Real-time güncellemeler için kritik)
    const task = tasks.find(t => t.id === initialTask?.id) || initialTask

    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editedTitle, setEditedTitle] = useState(task?.title || '')
    
    // User Search State
    const [userSearchQuery, setUserSearchQuery] = useState('')
    const [foundUsers, setFoundUsers] = useState<Profile[]>([])
    const [isSearchingUser, setIsSearchingUser] = useState(false)

    useEffect(() => {
        if (userSearchQuery.length < 2) {
            setFoundUsers([])
            return
        }
        const timer = setTimeout(async () => {
            setIsSearchingUser(true)
            try {
                const res = await fetch(`/api/profiles?q=${encodeURIComponent(userSearchQuery)}`)
                if (res.ok) {
                    const data = await res.json()
                    // Normalize keys
                    const normalized = data.map((p: any) => {
                        const n: any = {}
                        for (const k of Object.keys(p)) {
                            n[k.toLowerCase()] = p[k]
                        }
                        return n as Profile
                    })
                    setFoundUsers(normalized)
                }
            } finally {
                setIsSearchingUser(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [userSearchQuery])
    const [notes, setNotes] = useState(task?.notes || '')
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [isSubmittingComment, setIsSubmittingComment] = useState(false)

    useEffect(() => {
        if (task) {
            setEditedTitle(task.title)
            setNotes(task.notes || '')
            setIsEditingTitle(false)
        }
    }, [task?.id])

    const taskList = task ? lists.find(l => l.id === task.list_id) : null
    const taskFolder = taskList ? folders.find(f => f.id === taskList.folder_id) : null

    // Klasör Üyelerini Al
    const membersOfFolder = taskFolder ? folderMembers.filter(m => m.folder_id === taskFolder.id) : []

    const isOwner = taskFolder?.user_id === user?.id
    const isAssignee = task?.task_assignees?.some(ta => ta.user_id === user?.id)
    const isTaskCreator = task?.created_by === user?.id // Görevi oluşturan mı?
    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

    // Mevcut kullanıcının yetkileri
    const currentMembership = taskFolder ? folderMembers.find(m => m.folder_id === taskFolder.id && m.user_id === user?.id) : null
    // Herhangi bir yetkisi olan member düzenleme yapabilir (not, tarih, öncelik, yorum)
    const hasAnyPermission = currentMembership?.can_add_task || currentMembership?.can_assign_task || currentMembership?.can_delete_task
    const canEdit = isOwner || isAssignee || hasAnyPermission || isAdmin

    // Yetki + kendi görevi kontrolü: Sahip her şeyi yapabilir, memberlar sadece kendi görevlerini
    const canDelete = isOwner || (currentMembership?.can_delete_task && isTaskCreator) || isAdmin
    
    // Task assignment permissions: Admins/Superadmins have implicit access without needing folder membership
    // Standard users need either:
    // - Be the folder owner, OR
    // - Have can_assign_task permission in the folder, OR
    // - Be the task creator (can assign their own tasks)
    const canAssign = isAdmin || isOwner || currentMembership?.can_assign_task || isTaskCreator

    // İlerleme Hesaplama
    const totalAssignees = task?.task_assignees?.length || 0
    const completedAssignees = task?.task_assignees?.filter(ta => ta.is_completed).length || 0
    const progressPercentage = totalAssignees > 0 ? Math.round((completedAssignees / totalAssignees) * 100) : (task?.is_completed ? 100 : 0)

    const handleDelete = async () => {
        if (!task) return
        setIsConfirmOpen(true)
    }

    const confirmDelete = async () => {
        if (!task) return
        await deleteTask(task.id)
        showToast('Görev silindi', 'success')
        onClose()
    }

    const handleTitleUpdate = async () => {
        if (!task || !canEdit || !editedTitle.trim() || editedTitle === task.title) {
            setIsEditingTitle(false)
            return
        }
        await updateTask(task.id, { title: editedTitle })
        showToast('Görev adı güncellendi', 'success')
        setIsEditingTitle(false)
    }

    const handleNotesUpdate = async () => {
        if (!task || !canEdit) return
        const currentNotes = notes.trim()
        const originalNotes = (task.notes || '').trim()

        if (currentNotes === originalNotes) return

        await updateTask(task.id, { notes: currentNotes })
        showToast('Açıklama kaydedildi', 'success')
    }

    const handleToggleAssignee = async (userId: string) => {
        if (!task || !canAssign) return // Sorumlu atamayı sadece yetkili yapabilir
        const isAssigned = task.task_assignees?.some(ta => ta.user_id === userId)

        if (isAssigned) {
            // userId'yi gönder (API'de hem id hem user_id ile silme desteği var)
            await unassignTask(task.id, userId)
        } else {
            await assignTask(task.id, userId)
        }
    }

    const handleToggleMemberCompletion = async (assigneeUserId: string, currentStatus: boolean) => {
        if (!task) return
        // Sadece kendisi veya sahip değiştirebilir
        if (user?.id !== assigneeUserId && !isOwner) return

        await toggleAssigneeCompletion(task.id, assigneeUserId, currentStatus)
    }

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!task || !newComment.trim() || isSubmittingComment) return

        setIsSubmittingComment(true)
        await addComment(task.id, newComment.trim())
        setNewComment('')
        setIsSubmittingComment(false)
    }

    const handlePriorityChange = async (priority: Task['priority']) => {
        if (!task || !canEdit) return
        await updateTask(task.id, { priority })
        showToast(`Öncelik: ${priority}`, 'info')
    }

    const handleDateChange = async (date: string) => {
        if (!task || !canEdit) return
        await updateTask(task.id, { due_date: date })
        showToast('Tarih güncellendi', 'success')
    }

    return (
        <>
            <motion.div
                key="task-detail-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 md:hidden"
                onClick={onClose}
            />
            <motion.aside
                key="task-detail-sidebar"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed md:relative top-0 right-0 w-full md:w-[450px] h-full bg-card/95 backdrop-blur-xl border-l shadow-2xl z-50 md:z-auto flex flex-col shrink-0"
            >
                <header className="p-5 border-b flex items-center justify-between bg-card/50 shrink-0">
                    <div className="flex flex-col">
                        <h2 className="font-bold text-lg tracking-tight">Görev Detayları</h2>
                        {task && taskList && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5">
                                <ListIcon className="h-3 w-3" /> {taskFolder?.title} / {taskList.title}
                            </span>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9 hover:bg-accent transition-colors md:hidden">
                        <X className="h-5 w-5" />
                    </Button>
                </header>

                {task ? (
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                        {/* Görev Başlığı ve Progress */}
                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 bg-accent/30 rounded-2xl border border-accent/50 shadow-sm transition-all hover:bg-accent/40">
                                {/* Master toggle: Klasör sahibi, atanan kişi VEYA ADMIN değiştirebilir */}
                                <button
                                    onClick={() => (isOwner || isAssignee || isAdmin) && toggleTask(task.id, task.is_completed)}
                                    disabled={!isOwner && !isAssignee && !isAdmin}
                                    className={clsx(
                                        "mt-1 transition-transform active:scale-90",
                                        (!isOwner && !isAssignee && !isAdmin) && "opacity-30 cursor-not-allowed"
                                    )}
                                    title={(isOwner || isAssignee || isAdmin) ? "Görevi tamamla/aç" : "Yetkiniz yok"}
                                >
                                    {task.is_completed ? (
                                        <CheckCircle2 className="h-7 w-7 text-emerald-500 fill-emerald-500/10" />
                                    ) : (
                                        <Circle className={clsx("h-7 w-7 transition-colors", (isOwner || isAssignee || isAdmin) ? "text-muted-foreground hover:text-primary" : "text-muted-foreground/30")} />
                                    )}
                                </button>
                                <div className="flex-1 min-w-0">
                                    {isEditingTitle && canEdit ? (
                                        <textarea
                                            autoFocus
                                            rows={2}
                                            className="text-xl font-bold leading-snug bg-transparent outline-none w-full resize-none p-0 border-none focus:ring-0 text-foreground"
                                            value={editedTitle}
                                            onChange={(e) => setEditedTitle(e.target.value)}
                                            onBlur={handleTitleUpdate}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault()
                                                    handleTitleUpdate()
                                                }
                                            }}
                                        />
                                    ) : (
                                        <h3
                                            onClick={() => canEdit && setIsEditingTitle(true)}
                                            className={`text-xl font-bold leading-snug break-words ${canEdit ? 'cursor-pointer hover:text-primary' : ''} transition-colors ${task.is_completed ? 'line-through text-muted-foreground/60' : 'text-foreground'}`}
                                        >
                                            {task.title}
                                        </h3>
                                    )}
                                </div>
                            </div>

                            {/* İlerleme Çubuğu */}
                            <div className="px-1 space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                    <span>Görev İlerlemesi</span>
                                    <span>%{progressPercentage}</span>
                                </div>
                                <div className="h-2 w-full bg-accent/30 rounded-full overflow-hidden border border-accent/20">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercentage}%` }}
                                        className={clsx(
                                            "h-full transition-all duration-500",
                                            progressPercentage === 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Detay Kartları */}
                        <div className="grid gap-4">
                            <section className="space-y-3">
                                <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest px-1">Sorumlular ve Durum</h4>
                                <div className="bg-muted/30 rounded-2xl p-4 border border-muted/50 space-y-4">
                                    {/* Sorumlu Listesi ve Tamamlama Durumu */}
                                    <div className="space-y-4">
                                        {task.task_assignees && task.task_assignees.length > 0 ? (
                                            <div className="grid gap-2">
                                                {task.task_assignees.map((assignee) => {
                                                    const isMe = assignee.user_id === user?.id
                                                    const canToggleCompletion = isMe || isOwner || isAdmin
                                                    return (
                                                        <div key={assignee.user_id} className="flex items-center gap-3 p-2 rounded-xl bg-card/40 border border-transparent hover:border-accent transition-all group"
                                                            title={assignee.profile?.department ? `Birim: ${assignee.profile.department}` : ''}
                                                        >
                                                            <InitialsAvatar
                                                                name={assignee.profile?.full_name}
                                                                email={assignee.profile?.email}
                                                                className="h-8 w-8 rounded-full border border-primary/20"
                                                                textClassName="text-xs"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold truncate leading-none mb-0.5">
                                                                    {assignee.profile?.full_name || assignee.profile?.email.split('@')[0]}
                                                                    {isMe && <span className="ml-1.5 text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase">Siz</span>}
                                                                </p>
                                                                {assignee.profile?.department && (
                                                                    <p className="text-[10px] text-amber-600/80 font-medium truncate mb-0.5">
                                                                        {assignee.profile.department}
                                                                    </p>
                                                                )}
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {assignee.is_completed ? 'Tamamladı' : 'Devam ediyor'}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleToggleMemberCompletion(assignee.user_id, assignee.is_completed)}
                                                                disabled={!canToggleCompletion}
                                                                className={clsx(
                                                                    "p-1.5 rounded-lg transition-all",
                                                                    assignee.is_completed
                                                                        ? "bg-emerald-500/10 text-emerald-500"
                                                                        : "bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary",
                                                                    !canToggleCompletion && "opacity-30 cursor-not-allowed"
                                                                )}
                                                            >
                                                                {assignee.is_completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-xs text-muted-foreground italic bg-accent/10 rounded-xl">
                                                Henüz kimse atanmadı.
                                            </div>
                                        )}

                                        {/* Sorumlu Ekleme/Çıkarma - Controlled by canAssign permission */}
                                        {canAssign && (
                                            <div className="pt-2">
                                                {membersOfFolder.length > 0 ? (
                                                    <>
                                                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">Departmandan Sorumlu Ata</label>
                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            {membersOfFolder
                                                                .filter(member => member.user_id !== task.created_by) // Görevi oluşturanı gösterme
                                                                .map(member => {
                                                                    const isAssigned = task.task_assignees?.some(ta => ta.user_id === member.user_id)
                                                                    return (
                                                                        <button
                                                                            key={member.user_id}
                                                                            onClick={() => handleToggleAssignee(member.user_id)}
                                                                            className={clsx(
                                                                                "h-10 w-10 rounded-full border-2 transition-all hover:scale-110 relative",
                                                                                isAssigned
                                                                                    ? "border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/20"
                                                                                    : "border-muted/30 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:border-primary/50"
                                                                            )}
                                                                            title={`${member.profile?.full_name || member.profile?.email} ${isAssigned ? '(Atandı)' : ''}`}
                                                                        >
                                                                            <InitialsAvatar
                                                                                name={member.profile?.full_name}
                                                                                email={member.profile?.email}
                                                                                className={clsx(
                                                                                    "w-full h-full rounded-full",
                                                                                    isAssigned ? "ring-2 ring-primary/40" : ""
                                                                                )}
                                                                                textClassName="text-xs"
                                                                            />
                                                                            {isAssigned && (
                                                                                <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                                                                                    <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                                                                                </div>
                                                                            )}
                                                                        </button>
                                                                    )
                                                                })}
                                                        </div>
                                                    </>
                                                ) : null}
                                                
                                                {/* Global User Search - Always Visible if canAssign */}
                                                <div className="mt-1 relative border-t border-dashed border-muted/50 pt-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <Search className="h-3.5 w-3.5 text-primary" />
                                                        </div>
                                                        <label className="text-[10px] font-bold text-foreground uppercase tracking-wider">Tüm Personel Listesinde Ara</label>
                                                    </div>
                                                    <Input 
                                                        placeholder="İsim ile personel arayın..." 
                                                        className="h-9 text-xs bg-muted/30 focus:bg-background transition-colors border-muted hover:border-primary/50"
                                                        value={userSearchQuery}
                                                        onChange={e => setUserSearchQuery(e.target.value)}
                                                    />
                                                    
                                                    {userSearchQuery.length >= 2 && (
                                                        <div className="absolute top-full left-0 right-0 bg-popover border shadow-xl rounded-lg mt-1 z-50 max-h-48 overflow-y-auto overflow-x-hidden">
                                                            {isSearchingUser ? (
                                                                <div className="p-3 text-xs text-muted-foreground text-center">Aranıyor...</div>
                                                            ) : foundUsers.length === 0 ? (
                                                                <div className="p-3 text-xs text-muted-foreground text-center">Sonuç bulunamadı</div>
                                                            ) : (
                                                                foundUsers.map(u => {
                                                                     const isAssigned = task?.task_assignees?.some(ta => ta.user_id === u.id)
                                                                     // Check if already in the list above to avoid confusion, but allowing "Add" regardless is the requested feature
                                                                     return (
                                                                        <button
                                                                            key={u.id}
                                                                            onClick={() => {
                                                                                if (u.id) {
                                                                                    handleToggleAssignee(u.id)
                                                                                    if (!isAssigned) {
                                                                                        showToast(`${u.full_name} eklendi`, 'success')
                                                                                    }
                                                                                    setUserSearchQuery('')
                                                                                    setFoundUsers([])
                                                                                }
                                                                            }}
                                                                            className="w-full flex items-center gap-2 p-2 hover:bg-accent text-left text-xs transition-colors border-b border-muted/50 last:border-0"
                                                                        >
                                                                            <InitialsAvatar name={u.full_name} email={u.email} className="h-6 w-6 rounded-full shrink-0" textClassName="text-[9px]" />
                                                                            <div className="flex-1 overflow-hidden">
                                                                                <p className="truncate font-medium">{u.full_name}</p>
                                                                                <p className="truncate text-[9px] text-muted-foreground">{u.email}</p>
                                                                            </div>
                                                                            {isAssigned ? (
                                                                                <div className="h-5 w-5 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center shrink-0">
                                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="h-5 w-5 bg-primary/5 text-primary rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100">
                                                                                    <Plus className="h-3 w-3" />
                                                                                </div>
                                                                            )}
                                                                        </button>
                                                                     )
                                                                })
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-px bg-muted/50 mx-1" />

                                    {/* Son Tarih ve Öncelik */}
                                    <div className="flex items-center gap-6">
                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3" /> Son Tarih
                                            </label>
                                            <input
                                                type="date"
                                                className="bg-transparent border-none text-sm font-semibold text-foreground outline-none cursor-pointer focus:ring-0 hover:text-primary transition-colors disabled:cursor-default p-0"
                                                value={task.due_date?.split('T')[0] || ''}
                                                onChange={(e) => handleDateChange(e.target.value)}
                                                disabled={!canEdit}
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                                <Flag className="h-3 w-3" /> Öncelik
                                            </label>
                                            <select
                                                className="bg-transparent border-none text-sm font-semibold text-foreground outline-none cursor-pointer appearance-none focus:ring-0 hover:text-primary transition-colors disabled:cursor-default p-0"
                                                value={task.priority || 'medium'}
                                                onChange={(e) => handlePriorityChange(e.target.value as any)}
                                                disabled={!canEdit}
                                            >
                                                <option value="low">Düşük</option>
                                                <option value="medium">Orta</option>
                                                <option value="high">Yüksek</option>
                                                <option value="urgent">Acil</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Üye Notları / Yorumlar */}
                            <section className="space-y-4 pt-1">
                                <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest px-1">Üye Notları & Güncellemeler</h4>

                                <div className="space-y-4">
                                    {/* Yorum Listesi */}
                                    <div className="max-h-[300px] overflow-y-auto space-y-4 pr-1 scrollbar-hide">
                                        {task.comments && task.comments.length > 0 ? (
                                            task.comments.map((comment: any) => (
                                                <div key={comment.id} className="flex gap-3 group">
                                                    <InitialsAvatar
                                                        name={comment.profile?.full_name}
                                                        email={comment.profile?.email}
                                                        className="h-7 w-7 rounded-full shrink-0 mt-0.5"
                                                        textClassName="text-[10px]"
                                                    />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-bold text-foreground/80">{comment.profile?.full_name || 'Üye'}</span>
                                                            <span className="text-[9px] text-muted-foreground">{new Date(comment.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        <div className="bg-accent/40 rounded-2xl p-3 text-sm text-foreground/90 leading-relaxed border border-accent/20">
                                                            {comment.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-6 text-[11px] text-muted-foreground/60 border-2 border-dashed border-muted/50 rounded-2xl flex flex-col items-center gap-2">
                                                <MessageSquare className="h-4 w-4 opacity-20" />
                                                Henüz ek bir not düşülmemiş.
                                            </div>
                                        )}
                                    </div>

                                    {/* Yorum Ekleme Alanı */}
                                    {canEdit && (
                                        <form onSubmit={handleAddComment} className="flex gap-2">
                                            <Input
                                                placeholder="Bir not veya güncelleme yaz..."
                                                className="bg-accent/30 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30"
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                            />
                                            <Button
                                                type="submit"
                                                size="icon"
                                                className="rounded-xl shrink-0 h-10 w-10 shadow-lg shadow-primary/20"
                                                disabled={!newComment.trim() || isSubmittingComment}
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            </section>

                            {/* Genel Açıklama Paneli */}
                            <section className="space-y-3 pt-4 opacity-70 hover:opacity-100 transition-opacity">
                                <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest px-1">Genel Tanımlama</h4>
                                <div className="group relative">
                                    <textarea
                                        className="w-full min-h-[120px] p-5 text-sm bg-muted/10 hover:bg-muted/20 focus:bg-background rounded-2xl border border-muted/30 focus:border-primary/20 transition-all leading-relaxed outline-none resize-none shadow-inner disabled:opacity-75"
                                        placeholder={canEdit ? "Görevin genel amacını ve detaylarını buraya ekleyebilirsin..." : "Açıklama bulunmuyor..."}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        onBlur={handleNotesUpdate}
                                        readOnly={!canEdit}
                                    />
                                </div>
                            </section>

                            {/* Ekler / Dosyalar */}
                            <section className="space-y-3 pt-4">
                                <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest px-1 flex items-center gap-1.5">
                                    <Paperclip className="h-3 w-3" /> Ekler
                                    {task.attachments && task.attachments.length > 0 && (
                                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                            {task.attachments.length}
                                        </span>
                                    )}
                                </h4>

                                {/* Dosya Listesi */}
                                <AttachmentList
                                    attachments={task.attachments || []}
                                    onDelete={deleteAttachment}
                                    onBatchDelete={async (ids) => {
                                        const response = await fetch('/api/attachments/batch', {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ attachment_ids: ids })
                                        })
                                        if (!response.ok) throw new Error('Batch silme başarısız')
                                        await refreshTaskAttachments(task.id)
                                    }}
                                    canDelete={isOwner || isAdmin}
                                    currentUserId={user?.id}
                                />

                                {/* Dosya Yükleme */}
                                {canEdit && (
                                    <FileUpload
                                        taskId={task.id}
                                        onUploadComplete={() => refreshTaskAttachments(task.id)}
                                        disabled={!canEdit}
                                    />
                                )}
                            </section>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                            <div className="relative h-24 w-24 bg-accent/50 rounded-3xl flex items-center justify-center border border-accent/50 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                                <ListIcon className="h-10 w-10 text-primary opacity-40" />
                            </div>
                        </div>
                        <div className="space-y-2 max-w-[240px]">
                            <h3 className="font-bold text-lg text-foreground/80">Görev Seçilmedi</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Detayları görüntülemek, yorum yapmak veya sorumlu atamak için sol taraftan bir görev seçin.
                            </p>
                        </div>
                    </div>
                )}

                {task && (
                    <footer className="p-5 border-t flex items-center justify-between bg-muted/10 shrink-0">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Oluşturulma</span>
                            <span className="text-xs font-semibold">{new Date(task.created_at || '').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                        {canDelete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleDelete}
                                className="rounded-xl h-10 w-10 text-rose-500 hover:text-white hover:bg-rose-500 transition-all shadow-sm hover:shadow-rose-500/50"
                            >
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        )}
                    </footer>
                )}
            </motion.aside>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={confirmDelete}
                title="Görevi Sil"
                description="Bu görevi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
                confirmText="Görevi Sil"
            />
        </>
    )
}
