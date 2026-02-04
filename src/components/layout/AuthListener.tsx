'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthStore } from '@/store/useAuthStore'
import { useTaskStore } from '@/store/useTaskStore'

export default function AuthListener() {
    const { data: session, status } = useSession()
    const { setUser, setProfile } = useAuthStore()
    const { fetchInitialData } = useTaskStore()

    useEffect(() => {
        if (status === 'loading') {
            useAuthStore.setState({ isLoading: true })
            return
        }

        if (session?.user) {
            // User bilgilerini store'a kaydet
            setUser({
                id: session.user.id,
                email: session.user.email!,
                name: session.user.name,
                image: session.user.image
            })

            // Profile bilgisini de ayarla (NextAuth'dan geldiği için ayrıca fetch'e gerek yok)
            setProfile({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.name || undefined,
                avatar_url: session.user.image || undefined
            })

            // Verileri yükle
            fetchInitialData()
        } else {
            setUser(null)
            setProfile(null)
            useTaskStore.getState().reset()
        }

        // Loading state'ini kapat
        useAuthStore.setState({ isLoading: false })

    }, [session, status, setUser, setProfile, fetchInitialData])

    return null
}
