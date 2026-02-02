import { create } from 'zustand'
import { Profile } from '@/types/database'
import { useTaskStore } from './useTaskStore'

interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
}

interface AuthState {
    user: User | null
    profile: Profile | null
    isLoading: boolean
    setUser: (user: User | null) => void
    setProfile: (profile: Profile | null) => void
    signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    profile: null,
    isLoading: true,
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    signOut: async () => {
        try {
            const { handleSignOut } = await import('@/actions/auth')
            useTaskStore.getState().reset()
            set({ user: null, profile: null })
            await handleSignOut()
        } catch (error) {
            console.error('Çıkış yapılırken hata oluştu:', error)
            // Fallback
            window.location.href = '/login'
        }
    },
}))
