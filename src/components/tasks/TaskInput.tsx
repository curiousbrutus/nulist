'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTaskStore } from '@/store/useTaskStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button' // Added import for Button

interface TaskInputProps {
    listId: string
    placeholder?: string
}

export default function TaskInput({ listId, placeholder }: TaskInputProps) {
    const [title, setTitle] = useState('')
    const addTask = useTaskStore(state => state.addTask)

    const handleAdd = async () => { // Renamed from handleSubmit and adjusted for direct call
        if (!title.trim()) return

        await addTask(title, listId)
        setTitle('')
    }

    return (
        <div className={`relative group mb-8 bg-card border rounded-2xl shadow-sm transition-all focus-within:shadow-md focus-within:border-primary/20 p-2`}>
            <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <Plus className="h-5 w-5" />
                </div>
                <input
                    className="flex-1 bg-transparent border-none focus:ring-0 outline-none p-2 text-sm placeholder:text-muted-foreground/60"
                    placeholder={placeholder || "Neler yapacaksın?"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <Button
                    size="sm"
                    onClick={handleAdd}
                    className="rounded-xl px-4 font-semibold shadow-none"
                >
                    Ekle
                </Button>
            </div>
        </div>
    )
}
