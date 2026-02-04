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

        const loadUserData = async () => {
            if (session?.user) {
                // User bilgilerini store'a kaydet
                setUser({
                    id: session.user.id,
                    email: session.user.email!,
                    name: session.user.name,
                    image: session.user.image
                })

                // Fetch full profile data from API to get is_profile_complete
                try {
                    const res = await fetch('/api/profiles/me')
                    if (res.ok) {
                        const profileData = await res.json()
                        // Normalize keys to lowercase
                        const normalized: any = {}
                        for (const key of Object.keys(profileData)) {
                            normalized[key.toLowerCase()] = profileData[key]
                        }
                        setProfile(normalized)
                    } else {
                        // Fallback to basic profile from session
                        setProfile({
                            id: session.user.id,
                            email: session.user.email!,
                            full_name: session.user.name || undefined,
                            avatar_url: session.user.image || undefined
                        })
                    }
                } catch (error) {
                    console.error('Failed to fetch profile:', error)
                    // Fallback to basic profile from session
                    setProfile({
                        id: session.user.id,
                        email: session.user.email!,
                        full_name: session.user.name || undefined,
                        avatar_url: session.user.image || undefined
                    })
                }

                // Verileri yükle
                fetchInitialData()
            } else {
                setUser(null)
                setProfile(null)
                useTaskStore.getState().reset()
            }

            // Loading state'ini kapat
            useAuthStore.setState({ isLoading: false })
        }

        loadUserData()

    }, [session, status, setUser, setProfile, fetchInitialData])

    return null
}
