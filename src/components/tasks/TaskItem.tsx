'use client'

import { CheckCircle2, Circle, Star, Calendar, MessageSquare, Folder } from 'lucide-react'
import { Task } from '@/types/database'
import { useAuthStore } from '@/store/useAuthStore'
import { useTaskStore } from '@/store/useTaskStore'
import { clsx } from 'clsx'
import { motion } from 'framer-motion'
import { InitialsAvatar } from '@/components/ui/InitialsAvatar'

interface TaskItemProps {
    task: Task
}

export default function TaskItem({ task }: TaskItemProps) {
    const { user } = useAuthStore()
    const { folders, lists, toggleTask, setSelectedTask } = useTaskStore()

    const list = lists.find(l => l.id === task.list_id)
    const folder = folders.find(f => f.id === list?.folder_id)

    // Yetki Kontrolü: Klasör sahibi veya görev atananlarından biri mi?
    const totalAssignees = task.task_assignees?.length || 0
    const completedAssignees = task.task_assignees?.filter(ta => ta.is_completed).length || 0
    const progressPercentage = totalAssignees > 0 ? Math.round((completedAssignees / totalAssignees) * 100) : (task.is_completed ? 100 : 0)
    const commentCount = task.comments?.length || 0

    const isAssignee = task.task_assignees?.some(ta => ta.user_id === user?.id)
    const isOwner = folder?.user_id === user?.id
    const isAdmin = (user as any)?.role === 'admin'
    // Master toggle: Klasör sahibi, atanan kişi VEYA ADMIN değiştirebilir
    const canToggle = isOwner || isAssignee || isAdmin

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!canToggle) return

        toggleTask(task.id, task.is_completed)

        if (!task.is_completed) {
            const audio = new Audio('/ding.mp3')
            audio.play().catch(() => { })
        }
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedTask(task)}
            className={clsx(
                "group flex flex-col gap-2 p-3 bg-card hover:bg-accent/40 border rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden",
                task.is_completed && "opacity-60 bg-accent/20"
            )}
        >
            <div className="flex items-center gap-3">
                <button
                    onClick={handleToggle}
                    disabled={!canToggle}
                    className={clsx(
                        "transition-all active:scale-90 shrink-0",
                        canToggle ? "text-muted-foreground hover:text-primary" : "text-muted-foreground/30 cursor-not-allowed"
                    )}
                >
                    {task.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500/10" />
                    ) : (
                        <Circle className="h-5 w-5" />
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <p className={clsx(
                        "text-sm font-semibold truncate transition-all",
                        task.is_completed && "line-through text-muted-foreground"
                    )}>
                        {task.title}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {/* Departman / Liste bilgisi */}
                        {folder && list && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded">
                                <Folder className="h-2.5 w-2.5 text-amber-500" />
                                <span className="truncate max-w-[60px]">{folder.title}</span>
                                <span className="text-muted-foreground/50">/</span>
                                <span className="truncate max-w-[60px]">{list.title}</span>
                            </div>
                        )}
                        {task.due_date && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.due_date).toLocaleDateString('tr-TR')}
                            </div>
                        )}
                        {commentCount > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-primary/70 font-bold">
                                <MessageSquare className="h-3 w-3" />
                                {commentCount}
                            </div>
                        )}
                        {totalAssignees > 0 && (
                            <div className="text-[10px] text-muted-foreground font-medium">
                                {completedAssignees}/{totalAssignees} üye
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center -space-x-1.5 shrink-0 px-1">
                    {task.task_assignees?.slice(0, 3).map((ta) => (
                        <InitialsAvatar
                            key={ta.user_id}
                            name={ta.profile?.full_name}
                            email={ta.profile?.email}
                            className={clsx(
                                "h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold uppercase overflow-hidden ring-1 ring-black/5",
                                ta.is_completed && "opacity-50 grayscale-[0.5]"
                            )}
                            textClassName="text-[10px]"
                            title={`${ta.profile?.full_name || ta.profile?.email}
${ta.profile?.department ? `Birim: ${ta.profile.department}` : ''}
${ta.is_completed ? '(Tamamladı)' : ''}`}
                        />
                    ))}
                    {totalAssignees > 3 && (
                        <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                            +{totalAssignees - 3}
                        </div>
                    )}
                </div>

                <button
                    className="text-muted-foreground hover:text-amber-500 transition-colors shrink-0 md:opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); /* Favori mantığı buraya */ }}
                >
                    <Star className="h-4 w-4" />
                </button>
            </div>

            {/* İlerleme Çubuğu */}
            {totalAssignees > 0 && !task.is_completed && (
                <div className="mt-1 h-1 w-full bg-accent/30 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        className={clsx(
                            "h-full transition-all duration-700",
                            progressPercentage === 100 ? "bg-emerald-500" : "bg-primary/60"
                        )}
                    />
                </div>
            )}
        </motion.div>
    )
}
