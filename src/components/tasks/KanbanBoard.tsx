'use client'

import { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useTaskStore } from '@/store/useTaskStore'
import { useAuthStore } from '@/store/useAuthStore'
import TaskItem from './TaskItem'

export default function KanbanBoard() {
    const { user } = useAuthStore()
    const { tasks, selectedListId, lists, folders, toggleTask } = useTaskStore()

    // Filtre mantığı - page.tsx ile aynı
    let filteredTasks = tasks

    const isFocusMode = selectedListId?.startsWith('focus-')
    const isMyTasksMode = selectedListId === 'my-tasks'
    const selectedFolderId = selectedListId?.startsWith('folder-')
        ? selectedListId.replace('folder-', '')
        : null

    if (isFocusMode) {
        filteredTasks = tasks.filter(t => !t.is_completed)
    } else if (isMyTasksMode) {
        filteredTasks = tasks.filter(t =>
            t.task_assignees?.some(ta => ta.user_id === user?.id)
        )
    } else if (selectedFolderId) {
        const folderListIds = lists.filter(l => l.folder_id === selectedFolderId).map(l => l.id)
        filteredTasks = tasks.filter(t => folderListIds.includes(t.list_id))
    } else if (selectedListId) {
        filteredTasks = tasks.filter(t => t.list_id === selectedListId)
    }

    const activeTasks = filteredTasks.filter(t => !t.is_completed)
    const completedTasks = filteredTasks.filter(t => t.is_completed)

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            // Burada gerçek bir sıralama mantığı veya kolonlar arası geçiş yapılabilir.
            // Basitlik için sadece toggleTask simülasyonu yapıyoruz.
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-start">
            {/* Yapılacaklar */}
            <div className="flex flex-col gap-4 bg-muted/30 p-4 rounded-xl border min-h-[500px]">
                <h3 className="font-bold text-sm px-1 flex items-center justify-between">
                    Yapılacaklar
                    <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full">{activeTasks.length}</span>
                </h3>
                <div className="space-y-3">
                    {activeTasks.map(task => (
                        <TaskItem key={task.id || Math.random().toString()} task={task} />
                    ))}
                    {activeTasks.length === 0 && (
                        <div className="text-center py-10 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                            Görev yok
                        </div>
                    )}
                </div>
            </div>

            {/* Tamamlananlar */}
            <div className="flex flex-col gap-4 bg-muted/30 p-4 rounded-xl border min-h-[500px]">
                <h3 className="font-bold text-sm px-1 flex items-center justify-between">
                    Tamamlananlar
                    <span className="bg-green-500/10 text-green-600 text-[10px] px-2 py-0.5 rounded-full">{completedTasks.length}</span>
                </h3>
                <div className="space-y-3">
                    {completedTasks.map(task => (
                        <TaskItem key={task.id} task={task} />
                    ))}
                    {completedTasks.length === 0 && (
                        <div className="text-center py-10 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                            Henüz tamamlanan yok
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
