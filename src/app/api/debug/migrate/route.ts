import { NextRequest, NextResponse } from 'next/server'
import { executeNonQuery, executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    // Basic security check - only allow in development
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
    }

    try {
        const results: string[] = []

        // 1. parent_id ekle
        try {
            await executeNonQuery(`ALTER TABLE folders ADD parent_id VARCHAR2(36)`, {}, 'SYSTEM')
            results.push('✅ folders.parent_id added')
        } catch (e: any) {
            results.push(`ℹ️ folders.parent_id: ${e.message}`)
        }

        // 2. completed_at ekle
        try {
            await executeNonQuery(`ALTER TABLE tasks ADD completed_at TIMESTAMP WITH TIME ZONE`, {}, 'SYSTEM')
            results.push('✅ tasks.completed_at added')
        } catch (e: any) {
            results.push(`ℹ️ tasks.completed_at: ${e.message}`)
        }

        // 3. constraint ekle
        try {
            await executeNonQuery(`ALTER TABLE folders ADD CONSTRAINT fk_folders_parent FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE`, {}, 'SYSTEM')
            results.push('✅ fk_folders_parent added')
        } catch (e: any) {
            results.push(`ℹ️ fk_folders_parent: ${e.message}`)
        }

        // 4. Mevcut kolonları kontrol et
        const cols = await executeQuery(`SELECT table_name, column_name FROM user_tab_columns WHERE table_name IN ('FOLDERS', 'TASKS')`, {}, 'SYSTEM')

        return NextResponse.json({
            success: true,
            results,
            current_schema: cols
        })

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
