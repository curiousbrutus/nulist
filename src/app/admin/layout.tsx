'use client'

import { useAuthStore } from '@/store/useAuthStore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, profile, setProfile } = useAuthStore()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [hasAccess, setHasAccess] = useState(false)
    const [profileFetched, setProfileFetched] = useState(false)

    useEffect(() => {
        const checkAdminAccess = async () => {
            if (!user) {
                router.push('/login')
                setIsLoading(false)
                return
            }
            
            // Only fetch profile once
            if (!profileFetched) {
                setIsLoading(true)
                try {
                    const res = await fetch('/api/profiles/me')
                    if (res.ok) {
                        const data = await res.json()
                        // Normalize keys to lowercase
                        const normalized: any = {}
                        for (const key of Object.keys(data)) {
                            normalized[key.toLowerCase()] = data[key]
                        }
                        
                        console.log('Admin check - Fresh profile:', normalized)
                        
                        // Update profile in store
                        setProfile(normalized)
                        setProfileFetched(true)
                        
                        // Check admin access with fresh data
                        if (normalized.role === 'admin' || normalized.role === 'superadmin') {
                            setHasAccess(true)
                        } else {
                            console.log('Access denied - Role:', normalized.role)
                            setHasAccess(false)
                            router.push('/')
                        }
                    } else {
                        console.error('Profile fetch failed:', res.status)
                        setHasAccess(false)
                        router.push('/')
                    }
                } catch (e) {
                    console.error('Profile fetch error:', e)
                    setHasAccess(false)
                    router.push('/')
                }
                
                setIsLoading(false)
            } else if (profile) {
                // Profile already fetched, just check role
                if (profile.role === 'admin' || profile.role === 'superadmin') {
                    setHasAccess(true)
                } else {
                    setHasAccess(false)
                    router.push('/')
                }
                setIsLoading(false)
            }
        }

        checkAdminAccess()
    }, [user, profile, profileFetched, router, setProfile])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Admin paneli yükleniyor...</p>
                </div>
            </div>
        )
    }

    if (!hasAccess) {
        return null // Don't render anything, already redirecting
    }

    return <>{children}</>
}
