import { create } from 'zustand'
import { Folder, List, Task, FolderMember, TaskAttachment } from '@/types/database'
import { useToastStore } from '@/components/ui/toast'

interface TaskState {
    folders: Folder[]
    folderMembers: FolderMember[]
    lists: List[]
    tasks: Task[]
    selectedListId: string | null
    searchQuery: string
    selectedTask: Task | null

    setFolders: (folders: Folder[]) => void
    setLists: (lists: List[]) => void
    setTasks: (tasks: Task[]) => void
    setSelectedListId: (id: string | null) => void
    setSearchQuery: (query: string) => void
    setSelectedTask: (task: Task | null) => void

    fetchInitialData: () => Promise<void>
    addTask: (title: string, listId: string) => Promise<string | undefined>
    assignTask: (taskId: string, userId: string) => Promise<void>
    unassignTask: (taskId: string, assigneeId: string) => Promise<void>
    toggleAssigneeCompletion: (taskId: string, userId: string, currentStatus: boolean) => Promise<void>
    toggleTask: (taskId: string, currentStatus: boolean) => Promise<void>
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (taskId: string) => Promise<void>
    addComment: (taskId: string, content: string) => Promise<void>
    deleteAttachment: (attachmentId: string) => Promise<void>
    refreshTaskAttachments: (taskId: string) => Promise<void>

    // Missing methods
    addFolder: (title: string, parentId?: string) => Promise<void>
    deleteFolder: (folderId: string) => Promise<void>
    addList: (title: string, folderId: string) => Promise<void>
    deleteList: (listId: string) => Promise<void>

    reset: () => void
}

// API helper
async function apiCall<T>(url: string, options?: RequestInit): Promise<T | null> {
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers
            }
        })

        if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'API Error')
        }

        return await res.json()
    } catch (error: any) {
        console.error(`API Error (${url}):`, error.message)
        return null
    }
}

// Oracle column names uppercase olarak dönüyor, normalize edelim
// Ayrıca Oracle'dan 0/1 olarak gelen boolean'ları true/false'a çevir
const BOOLEAN_FIELDS = ['is_completed', 'can_add_task', 'can_assign_task', 'can_delete_task', 'can_add_list']

function normalizeKeys<T>(obj: any): T {
    if (!obj) return obj
    if (Array.isArray(obj)) {
        return obj.map(item => normalizeKeys(item)) as T
    }
    if (typeof obj === 'object') {
        const normalized: any = {}
        for (const key of Object.keys(obj)) {
            const lowerKey = key.toLowerCase()
            let value = obj[key]

            // Oracle 0/1 değerlerini boolean'a çevir
            if (BOOLEAN_FIELDS.includes(lowerKey) && (value === 0 || value === 1 || value === '0' || value === '1')) {
                value = Boolean(Number(value))
            }

            // Nested object kontrolü (profile gibi)
            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                normalized[lowerKey] = normalizeKeys(value)
            } else {
                normalized[lowerKey] = value
            }
        }
        return normalized as T
    }
    return obj
}

export const useTaskStore = create<TaskState>((set, get) => ({
    folders: [],
    folderMembers: [],
    lists: [],
    tasks: [],
    selectedListId: null,
    searchQuery: '',
    selectedTask: null,

    setFolders: (folders) => set({ folders }),
    setLists: (lists) => set({ lists }),
    setTasks: (tasks) => set({ tasks }),
    setSelectedListId: (id) => set({ selectedListId: id }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSelectedTask: (task) => set({ selectedTask: task }),

    fetchInitialData: async () => {
        try {
            const [folders, lists, tasks, folderMembers] = await Promise.all([
                apiCall<any[]>('/api/folders'),
                apiCall<any[]>('/api/lists'),
                apiCall<any[]>('/api/tasks'),
                apiCall<any[]>('/api/folder-members/all')
            ])

            if (folders) set({ folders: normalizeKeys<Folder[]>(folders) })
            if (lists) set({ lists: normalizeKeys<List[]>(lists) })

            // Tasks'ı normalize et ve task_assignees + comments + attachments ekle
            if (tasks) {
                const normalizedTasks = normalizeKeys<Task[]>(tasks)

                // Tüm task_assignees, comments ve attachments'ı paralel çek
                const [allAssignees, allComments, allAttachments] = await Promise.all([
                    apiCall<any[]>('/api/task-assignees/all'),
                    apiCall<any[]>('/api/comments/all'),
                    apiCall<any[]>('/api/attachments/all')
                ])

                const normalizedAssignees = allAssignees ? normalizeKeys<any[]>(allAssignees) : []
                const normalizedComments = allComments ? normalizeKeys<any[]>(allComments) : []
                const normalizedAttachments = allAttachments ? normalizeKeys<any[]>(allAttachments) : []

                // Remove duplicates by task ID
                const uniqueTasks = Array.from(
                    new Map(normalizedTasks.map(task => [task.id, task])).values()
                )

                // Her task'a kendi assignees, comments ve attachments'larını ekle
                const tasksWithDetails = uniqueTasks.map(task => ({
                    ...task,
                    task_assignees: normalizedAssignees.filter((a: any) => a.task_id === task.id),
                    comments: normalizedComments.filter((c: any) => c.task_id === task.id),
                    attachments: normalizedAttachments.filter((att: any) => att.task_id === task.id)
                }))

                set({ tasks: tasksWithDetails })
            }

            if (folderMembers) set({ folderMembers: normalizeKeys<FolderMember[]>(folderMembers) })
        } catch (error) {
            console.error('fetchInitialData error:', error)
        }
    },

    addTask: async (title, listId) => {
        const data = await apiCall<any>('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({ title, list_id: listId })
        })

        if (data) {
            const newTask = normalizeKeys<Task>(data)
            set({ tasks: [newTask, ...get().tasks] })

            // Görevi oluşturana otomatik ata
            if (newTask.id && newTask.created_by) {
                try {
                    await apiCall('/api/task-assignees', {
                        method: 'POST',
                        body: JSON.stringify({
                            task_id: newTask.id,
                            user_id: newTask.created_by
                        })
                    })
                    // Refresh data to get the assignment
                    await get().fetchInitialData()
                } catch (error) {
                    console.error('Auto-assign failed:', error)
                    // Görev eklendi ama atama başarısız, devam et
                }
            }

            return newTask.id
        }

        useToastStore.getState().showToast('Görev eklenemedi', 'error')
        return undefined
    },

    assignTask: async (taskId, userId) => {
        const data = await apiCall('/api/task-assignees', {
            method: 'POST',
            body: JSON.stringify({ task_id: taskId, user_id: userId })
        })

        if (!data) {
            useToastStore.getState().showToast('Atama yapılamadı', 'error')
            return
        }

        // Hemen refresh et
        await get().fetchInitialData()
        useToastStore.getState().showToast('Atama yapıldı', 'success')
    },

    unassignTask: async (taskId, userId) => {
        const res = await fetch(`/api/task-assignees/${userId}?task_id=${taskId}`, {
            method: 'DELETE'
        })

        if (!res.ok) {
            useToastStore.getState().showToast('Atama kaldırılamadı', 'error')
            return
        }

        // Hemen refresh et
        await get().fetchInitialData()
        useToastStore.getState().showToast('Atama kaldırıldı', 'success')
    },

    toggleAssigneeCompletion: async (taskId, userId, currentStatus) => {
        // Task assignee'nin completion durumunu toggle et
        // Not: Bu işlem için direkt bir API endpoint yok, folder-members PUT kullanabiliriz
        // Ancak task_assignees tablosunda is_completed field'i var
        // Şimdilik fetchInitialData ile refresh edelim
        // TODO: Gelecekte /api/task-assignees/[id] PUT endpoint'i eklenebilir
        await get().fetchInitialData()
    },

    toggleTask: async (taskId, currentStatus) => {
        const previousTasks = get().tasks
        const previousSelectedTask = get().selectedTask
        // Oracle 0/1 değerlerini boolean'a çevir
        const isCurrentlyCompleted = Boolean(currentStatus)
        const newStatus = !isCurrentlyCompleted

        // Optimistic update - Tasks array'ini güncelle
        set({
            tasks: previousTasks.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t)
        })

        // selectedTask'ı da güncelle (detail panel için)
        if (previousSelectedTask && previousSelectedTask.id === taskId) {
            set({ selectedTask: { ...previousSelectedTask, is_completed: newStatus } })
        }

        try {
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    completed: newStatus
                })
            })

            if (!res.ok) {
                const error = await res.json()
                console.error('Task toggle error:', error)
                // Rollback on error
                set({ tasks: previousTasks, selectedTask: previousSelectedTask })
                useToastStore.getState().showToast(error.error || 'Güncelleme hatası', 'error')
                return
            }

            const data = await res.json()
            
            // Update with server response to ensure consistency
            const normalizedData = normalizeKeys(data)
            set({
                tasks: previousTasks.map(t => t.id === taskId ? { ...t, ...normalizedData } : t)
            })
            
            if (previousSelectedTask && previousSelectedTask.id === taskId) {
                set({ selectedTask: { ...previousSelectedTask, ...normalizedData } })
            }

            // Show success toast only if marking as completed
            if (newStatus) {
                useToastStore.getState().showToast('Görev tamamlandı!', 'success')
            }
        } catch (error: any) {
            console.error('Task toggle error:', error)
            // Rollback on error
            set({ tasks: previousTasks, selectedTask: previousSelectedTask })
            useToastStore.getState().showToast('Güncelleme hatası', 'error')
        }
    },

    updateTask: async (taskId, updates) => {
        const previousTasks = get().tasks
        set({
            tasks: previousTasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
        })

        const data = await apiCall(`/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        })

        if (!data) {
            set({ tasks: previousTasks })
        }
    },

    deleteTask: async (taskId) => {
        const previousTasks = get().tasks
        set({
            tasks: previousTasks.filter(t => t.id !== taskId)
        })

        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })

        if (!res.ok) {
            set({ tasks: previousTasks })
            console.error('Görev silinemedi')
        }
    },

    addComment: async (taskId, content) => {
        const data = await apiCall('/api/comments', {
            method: 'POST',
            body: JSON.stringify({ task_id: taskId, content })
        })

        if (!data) {
            useToastStore.getState().showToast('Not eklenemedi', 'error')
            return
        }

        await get().fetchInitialData()
    },

    deleteAttachment: async (attachmentId) => {
        const res = await fetch(`/api/attachments/${attachmentId}`, {
            method: 'DELETE'
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Dosya silinemedi')
        }

        await get().fetchInitialData()
    },

    refreshTaskAttachments: async (taskId) => {
        // Task detayını çek (içinde attachments var)
        const data = await apiCall<any>(`/api/tasks/${taskId}`)

        if (data) {
            const normalizedTask = normalizeKeys<any>(data)
            const tasks = get().tasks.map(t =>
                t.id === taskId
                    ? { ...t, attachments: normalizedTask.attachments as TaskAttachment[] }
                    : t
            )
            set({ tasks })
        }
    },

    addFolder: async (title, parentId) => {
        const data = await apiCall<any>('/api/folders', {
            method: 'POST',
            body: JSON.stringify({ title, parent_id: parentId })
        })

        if (data) {
            const newFolder = normalizeKeys<Folder>(data)
            await get().fetchInitialData() // Refresh everything properly
        } else {
            useToastStore.getState().showToast('Klasör eklenemedi', 'error')
        }
    },

    deleteFolder: async (folderId) => {
        const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
        if (res.ok) {
            await get().fetchInitialData()
        } else {
            useToastStore.getState().showToast('Klasör silinemedi', 'error')
        }
    },

    addList: async (title, folderId) => {
        const data = await apiCall<any>('/api/lists', {
            method: 'POST',
            body: JSON.stringify({ title, folder_id: folderId })
        })

        if (data) {
            get().setSelectedListId(data.id || data.ID)
            await get().fetchInitialData()
            useToastStore.getState().showToast('Liste oluşturuldu', 'success')
        } else {
            useToastStore.getState().showToast('Liste oluşturulamadı', 'error')
        }
    },

    deleteList: async (listId) => {
        const res = await fetch(`/api/lists/${listId}`, { method: 'DELETE' })
        if (res.ok) {
            await get().fetchInitialData()
            if (get().selectedListId === listId) {
                get().setSelectedListId(null)
            }
            useToastStore.getState().showToast('Liste silindi', 'success')
        } else {
            useToastStore.getState().showToast('Liste silinemedi', 'error')
        }
    },

    reset: () => set({
        folders: [],
        folderMembers: [],
        lists: [],
        tasks: [],
        selectedListId: null
    })
}))
