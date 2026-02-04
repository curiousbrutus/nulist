'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OnboardingPage() {
    const router = useRouter()
    
    useEffect(() => {
        // Redirect to profile settings - onboarding is no longer used
        router.replace('/settings/profile')
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    )
}
