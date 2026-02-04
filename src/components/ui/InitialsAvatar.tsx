import React from 'react'
import clsx from 'clsx'

type InitialsAvatarProps = {
    name?: string | null
    email?: string | null
    className?: string
    textClassName?: string
    title?: string
    style?: React.CSSProperties
}

function getInitials(name?: string | null, email?: string | null) {
    const source = (name || '').trim() || (email?.split('@')[0] || '').trim()
    if (!source) return '?'

    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }

    return parts[0].slice(0, 2).toUpperCase()
}

function getColorSeed(name?: string | null, email?: string | null) {
    const source = (name || '').trim() || (email || '').trim() || '?'
    let hash = 0
    for (let i = 0; i < source.length; i += 1) {
        hash = source.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue} 70% 45%)`
}

export function InitialsAvatar({ name, email, className, textClassName, title, style }: InitialsAvatarProps) {
    const initials = getInitials(name, email)
    const backgroundColor = getColorSeed(name, email)

    return (
        <div
            className={clsx('rounded-full flex items-center justify-center font-bold uppercase text-white', className)}
            title={title}
            style={{ backgroundColor, ...style }}
        >
            <span className={clsx('leading-none', textClassName)}>{initials}</span>
        </div>
    )
}
