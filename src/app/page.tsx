'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, List as ListIcon, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useTaskStore } from '@/store/useTaskStore'
import Sidebar from '@/components/layout/Sidebar'
import TaskItem from '@/components/tasks/TaskItem'
import TaskInput from '@/components/tasks/TaskInput'
import KanbanBoard from '@/components/tasks/KanbanBoard'
import TaskDetail from '@/components/tasks/TaskDetail'
import TaskImportExport from '@/components/tasks/TaskImportExport'
import AIAssistant from '@/components/ai/AIAssistant'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const { user, isLoading, profile } = useAuthStore()
  const { tasks, selectedListId, lists, folders, folderMembers, searchQuery, selectedTask, setSelectedTask } = useTaskStore()
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isMyTasksMode, setIsMyTasksMode] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
    // Onboarding redirect removed - users can edit profile in /settings/profile
  }, [user, isLoading, router])

  // Context switch based on sidebar selection
  useEffect(() => {
    if (selectedListId && selectedListId.startsWith('focus-')) {
      setIsFocusMode(true)
      setIsMyTasksMode(false)
    } else if (selectedListId === 'my-tasks') {
      setIsFocusMode(false)
      setIsMyTasksMode(true)
    } else {
      setIsFocusMode(false)
      setIsMyTasksMode(false)
    }
  }, [selectedListId])

  // Departman/Liste değiştiğinde seçili görevi temizle
  useEffect(() => {
    setSelectedTask(null)
  }, [selectedListId, setSelectedTask])

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const selectedList = lists.find(l => l.id === selectedListId)

  // Folder seçildi mi kontrol et
  const selectedFolderId = selectedListId?.startsWith('folder-')
    ? selectedListId.replace('folder-', '')
    : null
  const selectedFolder = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null

  // Filter logic
  let filteredTasks = tasks

  // 1. Kategori/Liste/Departman Filtresi
  if (isFocusMode) {
    filteredTasks = tasks.filter(t => !t.is_completed)
  } else if (isMyTasksMode) {
    // Bana Atananlar: Sadece user'a atanmış görevleri getir
    filteredTasks = tasks.filter(t =>
      t.task_assignees?.some(ta => ta.user_id === user.id)
    )
  } else if (selectedFolderId) {
    // Departman seçiliyse: O folder'a ait tüm listelerin görevlerini getir
    const folderListIds = lists.filter(l => l.folder_id === selectedFolderId).map(l => l.id)
    filteredTasks = tasks.filter(t => folderListIds.includes(t.list_id))
  } else if (selectedListId) {
    // Liste seçiliyse: Sadece o listenin görevlerini getir
    filteredTasks = tasks.filter(t => t.list_id === selectedListId)
  }

  // 2. Arama Filtresi (Eğer arama yapılıyorsa kategori içinde veya genel arama yapar)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filteredTasks = filteredTasks.filter(t =>
      t.title.toLowerCase().includes(query) ||
      (t.notes && t.notes.toLowerCase().includes(query))
    )
  }

  const activeTasks = filteredTasks.filter(t => !t.is_completed)
  const completedTasks = filteredTasks.filter(t => t.is_completed)

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        <header className="h-14 border-b bg-background flex items-center justify-between px-6 shrink-0 relative z-10 transition-all">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg truncate">
              {searchQuery ? `Arama sonucu: ${searchQuery}` : (isFocusMode ? 'Bugün' : (isMyTasksMode ? 'Bana Atananlar' : (selectedFolder ? selectedFolder.title : (selectedList ? selectedList.title : 'Tüm Görevler'))))}
            </h1>
            {isFocusMode && !searchQuery && <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold">FOCUS</span>}
            {isMyTasksMode && !searchQuery && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold">ATANAN</span>}
          </div>

          <div className="flex items-center gap-2">
            {/* Import/Export Buttons (only for real lists) */}
            {selectedListId && selectedList && !isFocusMode && !isMyTasksMode && (
              <TaskImportExport listId={selectedListId} listName={selectedList.title} />
            )}
            
            {!isFocusMode && (
              <div className="flex items-center bg-muted p-1 rounded-lg">
                <Button
                  variant={viewMode === 'list' ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 px-2"
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className="h-7 px-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            )}
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full whitespace-nowrap">
              {filteredTasks.length} Görev
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-4xl mx-auto h-full overflow-visible">
            {viewMode === 'list' ? (
              <div className="space-y-8">
                {/* Dynamic Task Input Logic */}
                {(() => {
                  if (isFocusMode || isMyTasksMode) return null

                  // Case 1: Specific List Selected
                  if (selectedListId && !selectedFolderId) {
                      const list = lists.find(l => l.id === selectedListId)
                      if (!list) return null

                      const folder = folders.find(f => f.id === list.folder_id)
                      const isOwner = folder?.user_id === user.id
                      const membership = folderMembers.find(m => m.folder_id === folder?.id && m.user_id === user.id)
                      const canAddTask = isOwner || membership?.can_add_task

                      // Simply don't show input if no permission (no error message)
                      if (!canAddTask) return null
                      
                      return <TaskInput listId={selectedListId} />
                  }

                  // Case 2: Folder/Department Selected
                  if (selectedFolderId) {
                      const firstList = lists.find(l => l.folder_id === selectedFolderId)
                      
                      if (!firstList) {
                         return (
                           <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl text-amber-700 dark:text-amber-400 text-sm flex items-center gap-3">
                             <div className="bg-amber-500/10 p-2 rounded-lg">ℹ️</div>
                             <span>Bu departmanda henüz bir liste yok.</span>
                           </div>
                         )
                      }

                      const folder = folders.find(f => f.id === selectedFolderId)
                      const isOwner = folder?.user_id === user.id
                      const membership = folderMembers.find(m => m.folder_id === folder?.id && m.user_id === user.id)
                      const canAddTask = isOwner || membership?.can_add_task

                      // Simply don't show input if no permission (no error message)
                      if (!canAddTask) return null

                      return <TaskInput listId={firstList.id} placeholder={`${firstList.title} listesine ekle...`} />
                  }

                  // Case 3: Nothing Selected
                  return (
                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl text-primary text-sm flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">💡</div>
                      Görev eklemek için sol taraftan bir liste veya departman seçin.
                    </div>
                  )
                })()}

                <div className="space-y-2">
                  {activeTasks.map((task, index) => (
                    <TaskItem key={task.id || `active-${index}`} task={task} />
                  ))}
                </div>

                {completedTasks.length > 0 && !isFocusMode && (
                  <div className="space-y-2 pt-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase px-1">Tamamlananlar</h3>
                    {completedTasks.map((task, index) => (
                      <TaskItem key={task.id || `completed-${index}`} task={task} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <KanbanBoard />
            )}

            {filteredTasks.length === 0 && (
              <div className="text-center py-20 bg-background/50 rounded-2xl border-2 border-dashed border-muted">
                <p className="text-muted-foreground">Burada henüz bir görev yok.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Task Detail Sidebar */}
      <div className="hidden md:block border-l bg-card/95 backdrop-blur-xl">
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      </div>

      <AnimatePresence>
        {selectedTask && (
          <div className="md:hidden">
            <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
          </div>
        )}
      </AnimatePresence>

      {/* AI Assistant */}
      <AIAssistant listId={selectedListId || undefined} />
    </div>
  )
}
