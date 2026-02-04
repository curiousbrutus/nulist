import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Oracle column names are uppercase, normalize to lowercase
// Also convert Oracle 0/1 values to boolean for specified fields
const BOOLEAN_FIELDS = ['is_completed', 'can_add_task', 'can_assign_task', 'can_delete_task', 'can_add_list', 'is_profile_complete']

export function normalizeKeys<T>(obj: unknown): T {
    if (!obj) return obj as T
    if (Array.isArray(obj)) {
        return obj.map(item => normalizeKeys(item)) as T
    }
    if (typeof obj === 'object' && !(obj instanceof Date)) {
        const normalized: Record<string, unknown> = {}
        for (const key of Object.keys(obj as Record<string, unknown>)) {
            const lowerKey = key.toLowerCase()
            let value = (obj as Record<string, unknown>)[key]

            // Oracle 0/1 values to boolean conversion
            if (BOOLEAN_FIELDS.includes(lowerKey) && (value === 0 || value === 1 || value === '0' || value === '1')) {
                value = Boolean(Number(value))
            }

            // Nested object normalization (profile objects, etc)
            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                normalized[lowerKey] = normalizeKeys(value)
            } else {
                normalized[lowerKey] = value
            }
        }
        return normalized as T
    }
    return obj as T
}
