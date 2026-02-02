'use client'

import { useState, useEffect } from 'react'
import { Task, TaskAssignee, Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Trash2, MessageCircle, CheckCircle2, Circle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface TaskWithDetails extends Task {
    assignees?: TaskAssignee[]
    list_title?: string
    folder_title?: string
    created_by_name?: string
}

interface FeedbackItem {
    id: string
    content: string
    created_at: string
    author_name: string
}

export default function TasksManagement() {
    const { showToast } = useToast()
    const [tasks, setTasks] = useState<TaskWithDetails[]>([])
    const [users, setUsers] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null)
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    const [feedbackText, setFeedbackText] = useState('')
    const [feedbackHistory, setFeedbackHistory] = useState<FeedbackItem[]>([])
    const [selectedAssignee, setSelectedAssignee] = useState<string>('')
    const [showReassignModal, setShowReassignModal] = useState(false)

    useEffect(() => {
        fetchTasks()
        fetchUsers()
    }, [])

    const fetchTasks = async () => {
        try {
            const res = await fetch('/api/admin/tasks')
            if (res.ok) {
                const data = await res.json()
                setTasks(data)
            }
        } catch (error) {
            console.error('Fetch tasks error:', error)
            showToast('Görevler yüklenemedi', 'error')
        } finally {
            setLoading(false)
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
        }
    }

    const handleToggleCompletion = async (taskId: string, assigneeId: string, currentStatus: boolean) => {
        try {
            const res = await fetch(`/api/admin/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignee_id: assigneeId,
                    is_completed: !currentStatus
                })
            })
            if (res.ok) {
                showToast(!currentStatus ? 'Görev tamamlandı' : 'Görev tamamlanmadı olarak işaretlendi', 'success')
                fetchTasks()
                if (selectedTask?.id === taskId) {
                    setSelectedTask(prev => prev ? { ...prev, is_completed: !currentStatus } : null)
                }
            }
        } catch (error) {
            console.error('Toggle completion error:', error)
            showToast('Durum güncellenemedi', 'error')
        }
    }

    const handleAddFeedback = async () => {
        if (!feedbackText.trim() || !selectedTask) return

        try {
            const res = await fetch(`/api/admin/tasks/${selectedTask.id}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: feedbackText })
            })
            if (res.ok) {
                showToast('Geri bildirim eklendi', 'success')
                setFeedbackText('')
                // Reload feedback
                const historyRes = await fetch(`/api/admin/tasks/${selectedTask.id}/feedback`)
                if (historyRes.ok) {
                    const history = await historyRes.json()
                    setFeedbackHistory(history)
                }
            }
        } catch (error) {
            console.error('Add feedback error:', error)
            showToast('Geri bildirim eklenemedi', 'error')
        }
    }

    const handleReassign = async (taskId: string, newAssigneeId: string) => {
        if (!newAssigneeId) return

        try {
            const res = await fetch(`/api/admin/tasks/${taskId}/reassign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_assignee_id: newAssigneeId })
            })
            if (res.ok) {
                showToast('Sorumlu değiştirildi', 'success')
                setShowReassignModal(false)
                setSelectedAssignee('')
                fetchTasks()
            }
        } catch (error) {
            console.error('Reassign error:', error)
            showToast('Sorumlu değiştirilemedi', 'error')
        }
    }

    const handleDeleteTask = async (taskId: string, taskTitle: string) => {
        if (confirm(`"${taskTitle}" görevini silmek istediğinize emin misiniz?`)) {
            try {
                const res = await fetch(`/api/admin/tasks/${taskId}`, {
                    method: 'DELETE'
                })
                if (res.ok) {
                    showToast('Görev silindi', 'success')
                    setSelectedTask(null)
                    fetchTasks()
                } else {
                    showToast('Görev silinemedi', 'error')
                }
            } catch (error) {
                console.error('Delete task error:', error)
                showToast('Hata oluştu', 'error')
            }
        }
    }

    const filteredTasks = tasks.filter(task =>
        task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.folder_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.created_by_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0e27] dark:to-[#111736] p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Görev Yönetimi
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Tüm görevleri yönet, sorumlu ata ve geri bildirim ver
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Tasks List */}
                    <div className="lg:col-span-2">
                        {/* Search Bar */}
                        <div className="mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <Input
                                    placeholder="Görev ara..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Tasks Table */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Durum
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Görev
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Sorumlular
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                İşlemler
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                                                    Yükleniyor...
                                                </td>
                                            </tr>
                                        ) : filteredTasks.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                                                    Görev bulunamadı
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTasks.map((task) => (
                                                <tr 
                                                    key={task.id} 
                                                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${selectedTask?.id === task.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                                    onClick={() => {
                                                        setSelectedTask(task)
                                                        fetchFeedback(task.id)
                                                    }}
                                                >
                                                    <td className="px-4 py-4">
                                                        {task.is_completed ? (
                                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-gray-400" />
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                                                            {task.title}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {task.folder_title}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {task.assignees?.slice(0, 2).map(a => (
                                                                <span key={a.user_id} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-1 rounded">
                                                                    {a.profile?.full_name || 'N/A'}
                                                                </span>
                                                            ))}
                                                            {(task.assignees?.length || 0) > 2 && (
                                                                <span className="text-xs text-gray-500">
                                                                    +{(task.assignees?.length || 0) - 2}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setSelectedTask(task)
                                                                setShowFeedbackModal(true)
                                                            }}
                                                        >
                                                            <MessageCircle className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Task Details Panel */}
                    {selectedTask && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 h-fit sticky top-8">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Görev Detayları
                            </h3>

                            <div className="space-y-4">
                                {/* Task Title */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Başlık</p>
                                    <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedTask.title}</p>
                                </div>

                                {/* Status */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Durum</p>
                                    <Button
                                        size="sm"
                                        className={`mt-2 ${selectedTask.is_completed ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                                        onClick={() => {
                                            if (selectedTask.assignees && selectedTask.assignees.length > 0) {
                                                handleToggleCompletion(
                                                    selectedTask.id,
                                                    selectedTask.assignees[0].user_id,
                                                    selectedTask.is_completed
                                                )
                                            }
                                        }}
                                    >
                                        {selectedTask.is_completed ? '✓ Tamamlandı' : '○ Beklemede'}
                                    </Button>
                                </div>

                                {/* Assignees */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sorumlular</p>
                                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                        {selectedTask.assignees?.map(a => (
                                            <div key={a.user_id} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                                <span className="text-sm text-gray-900 dark:text-white">
                                                    {a.profile?.full_name || 'N/A'}
                                                </span>
                                                <span className={`text-xs ${a.is_completed ? 'text-green-600' : 'text-orange-600'}`}>
                                                    {a.is_completed ? '✓' : '○'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                        size="sm"
                                        onClick={() => setShowReassignModal(true)}
                                    >
                                        Sorumlu Değiştir
                                    </Button>
                                    <Button
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                        size="sm"
                                        onClick={() => setShowFeedbackModal(true)}
                                    >
                                        Geri Bildirim Ver
                                    </Button>
                                    <Button
                                        className="w-full bg-red-600 hover:bg-red-700"
                                        size="sm"
                                        onClick={() => handleDeleteTask(selectedTask.id, selectedTask.title)}
                                    >
                                        Sil
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Feedback Modal */}
                {showFeedbackModal && selectedTask && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Geri Bildirim: {selectedTask.title}
                            </h3>

                            <div className="space-y-4">
                                {/* Feedback History */}
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {feedbackHistory.map(fb => (
                                        <div key={fb.id} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                {fb.author_name}
                                            </p>
                                            <p className="text-sm text-gray-900 dark:text-white mt-1">
                                                {fb.content}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* New Feedback Input */}
                                <textarea
                                    placeholder="Geri bildirim yazın..."
                                    className="w-full h-20 p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                />

                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                        onClick={handleAddFeedback}
                                    >
                                        Gönder
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setShowFeedbackModal(false)}
                                    >
                                        Kapat
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reassign Modal */}
                {showReassignModal && selectedTask && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Sorumlu Değiştir
                            </h3>

                            <div className="space-y-4">
                                <select
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    value={selectedAssignee}
                                    onChange={(e) => setSelectedAssignee(e.target.value)}
                                >
                                    <option value="">Sorumlu seçin...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.full_name} ({user.email})
                                        </option>
                                    ))}
                                </select>

                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                        onClick={() => handleReassign(selectedTask.id, selectedAssignee)}
                                    >
                                        Değiştir
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            setShowReassignModal(false)
                                            setSelectedAssignee('')
                                        }}
                                    >
                                        Kapat
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    async function fetchFeedback(taskId: string) {
        try {
            const res = await fetch(`/api/admin/tasks/${taskId}/feedback`)
            if (res.ok) {
                const history = await res.json()
                setFeedbackHistory(history)
            }
        } catch (error) {
            console.error('Fetch feedback error:', error)
        }
    }
}
