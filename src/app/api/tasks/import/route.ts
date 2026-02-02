import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

// Priority mapping
const PRIORITY_MAP: Record<string, string> = {
    'Düşük': 'Düşük',
    'Orta': 'Orta',
    'Yüksek': 'Yüksek',
    'Acil': 'Acil',
    'low': 'Düşük',
    'medium': 'Orta',
    'high': 'Yüksek',
    'urgent': 'Acil'
}

function normalizePriority(priority: string): string {
    return PRIORITY_MAP[priority] || 'Orta'
}

// POST /api/tasks/import - Import tasks from Excel/CSV
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const listId = formData.get('list_id') as string

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 })
        }

        if (!listId) {
            return NextResponse.json({ error: 'list_id is required' }, { status: 400 })
        }

        // Read file
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Parse Excel/CSV
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)

        if (data.length === 0) {
            return NextResponse.json({ error: 'File is empty' }, { status: 400 })
        }

        const imported: any[] = []
        const errors: any[] = []

        // Get all profiles for assignee matching
        const profiles = await executeQuery(
            `SELECT id, full_name, email, LOWER(full_name) as name_lower FROM profiles`,
            {},
            session.user.id
        ) as any[]

        const nameToId: Record<string, string> = {}
        profiles.forEach((p: any) => {
            const id = p.id || p.ID
            const name = p.full_name || p.FULL_NAME
            const nameLower = p.name_lower || p.NAME_LOWER
            nameToId[nameLower] = id
        })

        for (let i = 0; i < data.length; i++) {
            const row: any = data[i]
            
            try {
                // Support both Turkish and English column headers
                const title = row['Görev Adı'] || row['Task Name'] || row['Title'] || row['title']
                const notes = row['Açıklama'] || row['Description'] || row['notes'] || ''
                const priority = row['Öncelik'] || row['Priority'] || row['priority'] || 'Orta'
                const dueDateStr = row['Bitiş Tarihi'] || row['Due Date'] || row['due_date'] || ''
                const assigneesStr = row['Atananlar'] || row['Assignees'] || row['assignees'] || ''

                if (!title || title.toString().trim().length === 0) {
                    errors.push({ row: i + 2, error: 'Görev adı boş olamaz' })
                    continue
                }

                // Create task
                const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                
                // Parse due date
                let dueDate = null
                if (dueDateStr) {
                    const parsed = new Date(dueDateStr)
                    if (!isNaN(parsed.getTime())) {
                        dueDate = parsed.toISOString()
                    }
                }

                // Insert task
                if (dueDate) {
                    await executeNonQuery(
                        `INSERT INTO tasks (id, list_id, title, notes, due_date, priority, created_by, is_completed)
                         VALUES (:id, :list_id, :title, :notes, 
                                 TO_TIMESTAMP(:due_date, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
                                 :priority, :created_by, 0)`,
                        {
                            id: taskId,
                            list_id: listId,
                            title: title.toString().substring(0, 255),
                            notes: notes.toString(),
                            due_date: dueDate,
                            priority: normalizePriority(priority.toString()),
                            created_by: session.user.id
                        },
                        session.user.id
                    )
                } else {
                    await executeNonQuery(
                        `INSERT INTO tasks (id, list_id, title, notes, priority, created_by, is_completed)
                         VALUES (:id, :list_id, :title, :notes, :priority, :created_by, 0)`,
                        {
                            id: taskId,
                            list_id: listId,
                            title: title.toString().substring(0, 255),
                            notes: notes.toString(),
                            priority: normalizePriority(priority.toString()),
                            created_by: session.user.id
                        },
                        session.user.id
                    )
                }

                // Assign users
                if (assigneesStr && assigneesStr.toString().trim().length > 0) {
                    const assigneeNames = assigneesStr.toString().split(',').map((n: string) => n.trim())
                    
                    for (const name of assigneeNames) {
                        const userId = nameToId[name.toLowerCase()]
                        if (userId) {
                            await executeNonQuery(
                                `INSERT INTO task_assignees (task_id, user_id, is_completed)
                                 VALUES (:task_id, :user_id, 0)`,
                                { task_id: taskId, user_id: userId },
                                session.user.id
                            )
                        }
                    }
                }

                imported.push({ row: i + 2, task_id: taskId, title })

            } catch (error: any) {
                errors.push({ row: i + 2, error: error.message })
            }
        }

        return NextResponse.json({
            success: true,
            imported: imported.length,
            errors: errors.length,
            details: {
                imported,
                errors
            }
        })

    } catch (error: any) {
        console.error('Import error:', error)
        return NextResponse.json(
            { error: 'Import failed', details: error.message },
            { status: 500 }
        )
    }
}
