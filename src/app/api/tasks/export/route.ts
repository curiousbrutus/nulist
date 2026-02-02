import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

// GET /api/tasks/export?list_id=xxx&format=xlsx|csv
// POST /api/tasks/export - Secretary filtered export
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const listId = searchParams.get('list_id')
        const format = searchParams.get('format') || 'xlsx'

        if (!listId) {
            return NextResponse.json({ error: 'list_id is required' }, { status: 400 })
        }

        return await exportTasks(session, { list_id: listId, format })
    } catch (error: any) {
        console.error('Export error:', error)
        return NextResponse.json(
            { error: 'Export failed', details: error.message },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        return await exportTasks(session, body)
    } catch (error: any) {
        console.error('Export error:', error)
        return NextResponse.json(
            { error: 'Export failed', details: error.message },
            { status: 500 }
        )
    }
}

async function exportTasks(session: any, options: any) {
    const { list_id, format = 'xlsx', user_ids, start_date, end_date, meeting_type, branch_filter } = options

    // Check if secretary mode (has user_ids filter)
    const isSecretaryExport = user_ids || start_date || end_date || meeting_type || branch_filter

    if (isSecretaryExport) {
        // Get user profile for permission check
        const userProfile = await executeQuery(
            `SELECT role, branch FROM profiles WHERE id = :id`,
            { id: session.user.id },
            session.user.id
        )

        if (!userProfile || userProfile.length === 0) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        const userRole = userProfile[0].role
        const userBranch = userProfile[0].branch

        if (userRole !== 'secretary' && userRole !== 'superadmin') {
            return NextResponse.json(
                { error: 'Bu işlem için sekreter veya superadmin yetkisi gereklidir' },
                { status: 403 }
            )
        }

        // Build secretary export query
        return await exportSecretaryTasks(session, {
            user_ids,
            start_date,
            end_date,
            meeting_type,
            format,
            userRole,
            userBranch
        })
    }

    // Original list export
    if (!list_id) {
        return NextResponse.json({ error: 'list_id is required for regular export' }, { status: 400 })
    }

    // Get list name
    const lists = await executeQuery(
        `SELECT title FROM lists WHERE id = :id`,
        { id: list_id },
        session.user.id
    )

    const listName = lists.length > 0 ? (lists[0] as any).TITLE || (lists[0] as any).title : 'Tasks'

    // Get all tasks with assignees
    const tasks = await executeQuery(
        `SELECT 
                t.id,
                t.title,
                t.notes,
                t.priority,
                t.due_date,
                t.is_completed,
                t.created_at,
                t.completed_at,
                (SELECT LISTAGG(p.full_name, ', ') WITHIN GROUP (ORDER BY p.full_name)
                 FROM task_assignees ta 
                 JOIN profiles p ON ta.user_id = p.id
                 WHERE ta.task_id = t.id) as assignees,
                creator.full_name as created_by_name
             FROM tasks t
             LEFT JOIN profiles creator ON t.created_by = creator.id
             WHERE t.list_id = :list_id
             ORDER BY t.created_at DESC`,
        { list_id: list_id },
        session.user.id
    )

    if (tasks.length === 0) {
        return NextResponse.json({ error: 'No tasks found' }, { status: 404 })
    }

    // Normalize data
    const data = tasks.map((task: any) => {
        // Handle case-insensitive keys
        const t = Object.keys(task).reduce((acc: any, key) => {
            acc[key.toLowerCase()] = task[key]
            return acc
        }, {})

        return {
            'SIRA': t.row_number || '',
            'İŞİN ATANDIĞI TARİH': t.created_at ? new Date(t.created_at).toLocaleString('tr-TR') : '',
            'İŞİN BELİRLENDİĞİ TOPLANTI': listName,
            'YAPILACAK İŞ': t.title || '',
            'İŞİN BİRİNCİL SORUMLUSU': t.assignees || '',
            'İŞİN İKİNCİL SORUMLUSU': '',
            'TERMİN TARİHİ': t.due_date ? new Date(t.due_date).toLocaleString('tr-TR') : '',
            'AÇIKLAMA': t.notes || '',
            'BİTİŞ TARİHİ': t.completed_at ? new Date(t.completed_at).toLocaleString('tr-TR') : '',
            'DURUMU': t.is_completed ? 'Tamamlandı' : 'Devam Ediyor'
        }
    })

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, listName.substring(0, 31))

    // Set column widths
    const colWidths = [
        { wch: 40 }, // Görev Adı
        { wch: 50 }, // Açıklama
        { wch: 10 }, // Öncelik
        { wch: 15 }, // Bitiş Tarihi
        { wch: 15 }, // Durum
        { wch: 30 }, // Atananlar
        { wch: 20 }, // Oluşturan
        { wch: 15 }  // Oluşturma Tarihi
    ]
    worksheet['!cols'] = colWidths

    // Generate file
    let buffer: Buffer
    let contentType: string
    let fileName: string

    if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(worksheet)
        buffer = Buffer.from('\ufeff' + csv, 'utf-8') // Add BOM for Excel Turkish character support
        contentType = 'text/csv; charset=utf-8'
        fileName = `${listName}_${new Date().toISOString().split('T')[0]}.csv`
    } else {
        buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileName = `${listName}_${new Date().toISOString().split('T')[0]}.xlsx`
    }

    // Convert to ArrayBuffer first, then Uint8Array for Response
    const arrayBuffer = buffer instanceof ArrayBuffer
        ? buffer
        : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

    const bodyBuffer = new Uint8Array(arrayBuffer)

    return new Response(bodyBuffer, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
            'Content-Length': bodyBuffer.length.toString()
        }
    })
}

async function exportSecretaryTasks(session: any, options: any) {
    const { user_ids, start_date, end_date, meeting_type, format, userRole, userBranch } = options

    // Build query with filters
    let sql = `
        SELECT 
            ROW_NUMBER() OVER (ORDER BY t.created_at DESC) as "SIRA",
            TO_CHAR(t.created_at, 'DD.MM.YYYY HH24:MI') as "İŞİN ATANDIĞI TARİH",
            l.title as "İŞİN BELİRLENDİĞİ TOPLANTI",
            t.title as "YAPILACAK İŞ",
            p.full_name as "İŞİN BİRİNCİL SORUMLUSU",
            '' as "İŞİN İKİNCİL SORUMLUSU",
            TO_CHAR(t.due_date, 'DD.MM.YYYY HH24:MI') as "TERMİN TARİHİ",
            t.description as "AÇIKLAMA",
            TO_CHAR(t.completed_at, 'DD.MM.YYYY HH24:MI') as "BİTİŞ TARİHİ",
            CASE 
                WHEN t.is_completed = 1 THEN 'Tamamlandı'
                ELSE 'Devam Ediyor'
            END as "DURUMU"
        FROM tasks t
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        LEFT JOIN profiles p ON ta.user_id = p.id
        LEFT JOIN lists l ON t.list_id = l.id
        LEFT JOIN folders f ON l.folder_id = f.id
        WHERE 1=1
    `

    const params: any = {}

    // Secretary can only see their branch (unless superadmin)
    if (userRole === 'secretary' && userBranch) {
        sql += ` AND t.branch = :user_branch`
        params.user_branch = userBranch
    }

    // Filter by selected users
    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
        const placeholders = user_ids.map((_, i) => `:user_id_${i}`).join(', ')
        sql += ` AND ta.user_id IN (${placeholders})`
        user_ids.forEach((id: string, i: number) => {
            params[`user_id_${i}`] = id
        })
    }

    // Filter by date range
    if (start_date) {
        sql += ` AND t.created_at >= TO_TIMESTAMP(:start_date, 'YYYY-MM-DD')`
        params.start_date = start_date
    }

    if (end_date) {
        sql += ` AND t.due_date <= TO_TIMESTAMP(:end_date, 'YYYY-MM-DD') + INTERVAL '1' DAY`
        params.end_date = end_date
    }

    // Filter by meeting type
    if (meeting_type) {
        sql += ` AND t.meeting_type = :meeting_type`
        params.meeting_type = meeting_type
    }

    sql += ` ORDER BY t.created_at DESC`

    const tasks = await executeQuery(sql, params, session.user.id)

    if (!tasks || tasks.length === 0) {
        return NextResponse.json(
            { error: 'Seçilen filtrelere uygun görev bulunamadı' },
            { status: 404 }
        )
    }

    // Normalize keys to lowercase for XLSX
    const normalizedTasks = tasks.map(task => {
        const normalized: any = {}
        for (const key in task) {
            normalized[key] = task[key]
        }
        return normalized
    })

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(normalizedTasks)

    // Auto-size columns
    const colWidths = Object.keys(normalizedTasks[0] || {}).map(key => ({
        wch: Math.max(
            key.length + 2,
            ...normalizedTasks.map(row => String(row[key] || '').length)
        )
    }))
    ws['!cols'] = colWidths

    let buffer: Buffer
    let contentType: string
    let fileName: string

    if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(ws)
        buffer = Buffer.from('\ufeff' + csv, 'utf-8')
        contentType = 'text/csv; charset=utf-8'
        fileName = `sekreter-raporu-${new Date().toISOString().split('T')[0]}.csv`
    } else {
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Görevler')
        buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileName = `sekreter-raporu-${new Date().toISOString().split('T')[0]}.xlsx`
    }

    // Convert Buffer to Uint8Array for Response compatibility
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const bodyBuffer = new Uint8Array(arrayBuffer)

    return new Response(bodyBuffer, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
            'Content-Length': bodyBuffer.length.toString()
        }
    })
}
