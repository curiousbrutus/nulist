import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const FREE_MODELS = [
    'nvidia/nemotron-nano-12b-v2-vl:free', // Primary - Vision + Language
    'google/gemini-2.0-flash-exp:free',
    'google/gemini-flash-1.5',
    'meta-llama/llama-3.2-3b-instruct:free',
    'nousresearch/hermes-3-llama-3.1-405b:free'
]

// POST /api/ai/chat - AI assistant for task analysis
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { message, context, images } = body

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        // Check if API key is configured
        if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your-openrouter-api-key-here') {
            return NextResponse.json({ 
                error: 'AI service not configured',
                details: 'OpenRouter API key is missing. Please add OPENROUTER_API_KEY to .env.local file. Get your free key at https://openrouter.ai/keys'
            }, { status: 503 })
        }

        // Get comprehensive task context
        let contextData = ''
        let userTasksData = ''
        
        // Get tasks from current list if provided
        if (context?.list_id) {
            const listTasks = await executeQuery(
                `SELECT t.title, t.notes, t.priority, t.due_date, t.is_completed,
                        (SELECT LISTAGG(p.full_name, ', ') WITHIN GROUP (ORDER BY p.full_name)
                         FROM task_assignees ta 
                         JOIN profiles p ON ta.user_id = p.id
                         WHERE ta.task_id = t.id) as assignees,
                        l.title as list_name
                 FROM tasks t
                 JOIN lists l ON t.list_id = l.id
                 WHERE t.list_id = :list_id
                 ORDER BY t.due_date NULLS LAST
                 FETCH FIRST 50 ROWS ONLY`,
                { list_id: context.list_id },
                session.user.id
            ) as any[]

            if (listTasks.length > 0) {
                const listName = (listTasks[0] as any).LIST_NAME || (listTasks[0] as any).list_name
                contextData = `\n\n=== ${listName} Listesi Görevleri ===\n` + listTasks.map((t: any) => {
                    const title = t.title || t.TITLE
                    const priority = t.priority || t.PRIORITY || 'Orta'
                    const completed = (t.is_completed || t.IS_COMPLETED) ? '✓ Tamamlandı' : '○ Devam Ediyor'
                    const assignees = t.assignees || t.ASSIGNEES || 'Atanmamış'
                    const dueDate = t.due_date || t.DUE_DATE
                    const dueDateStr = dueDate ? `, Bitiş: ${new Date(dueDate).toLocaleDateString('tr-TR')}` : ''
                    const notes = t.notes || t.NOTES
                    const notesStr = notes ? `\n  Not: ${notes.substring(0, 100)}${notes.length > 100 ? '...' : ''}` : ''
                    return `• ${title}\n  Durum: ${completed} | Öncelik: ${priority}${dueDateStr}\n  Atanan: ${assignees}${notesStr}`
                }).join('\n\n')
            }
        }
        
        // Get user's own assigned tasks
        const myTasks = await executeQuery(
            `SELECT t.title, t.priority, t.due_date, t.is_completed,
                    l.title as list_name,
                    f.title as folder_name
             FROM tasks t
             JOIN task_assignees ta ON t.id = ta.task_id
             JOIN lists l ON t.list_id = l.id
             JOIN folders f ON l.folder_id = f.id
             WHERE ta.user_id = :user_id
             AND t.is_completed = 0
             ORDER BY t.due_date NULLS LAST
             FETCH FIRST 20 ROWS ONLY`,
            { user_id: session.user.id },
            session.user.id
        ) as any[]

        if (myTasks.length > 0) {
            userTasksData = `\n\n=== Kullanıcının Atandığı Aktif Görevler (${myTasks.length} adet) ===\n` + myTasks.map((t: any) => {
                const title = t.title || t.TITLE
                const priority = t.priority || t.PRIORITY || 'Orta'
                const folder = t.folder_name || t.FOLDER_NAME
                const list = t.list_name || t.LIST_NAME
                const dueDate = t.due_date || t.DUE_DATE
                const dueDateStr = dueDate ? `, Bitiş: ${new Date(dueDate).toLocaleDateString('tr-TR')}` : ''
                return `• ${title} (${folder} > ${list})\n  Öncelik: ${priority}${dueDateStr}`
            }).join('\n')
        }

        const systemPrompt = `Sen Çorlu Optimed Hastanesi'nin görev yönetim asistanısın. Rolün:

**YAPABİLECEĞİN ŞEYLER:**
- Kullanıcının görevlerini analiz et ve öncelik sırası öner
- Geciken veya yaklaşan görevler hakkında bilgi ver
- Görev dağılımı ve iş yükü hakkında gözlem sun
- Sorulan sorulara görevler hakkında bilgi ver
- Nasıl daha verimli çalışabileceği konusunda tavsiye ver

**YAPAMAYACAĞIN ŞEYLER:**
- Görevleri değiştir, sil veya düzenle (SADECE OKUMA YETKİN VAR)
- Kullanıcı adına görev ata veya atamaları değiştir
- Tarih veya öncelikleri güncelle
- Veritabanında herhangi bir değişiklik yap

**ÖNEMLİ KURALLAR:**
1. Her zaman Türkçe konuş
2. Kısa, net ve profesyonel cevaplar ver
3. Eğer bir değişiklik istenirse, şunu söyle: "Bu işlemi gerçekleştiremem, ancak görev sahibi veya yönetici yapabilir."
4. Veriler salt okunurdur - analiz ve bilgilendirme amaçlıdır
5. Hastane çalışanlarına saygılı ve yardımcı ol

**MEVCUT VERİLER:**${contextData}${userTasksData}

Kullanıcı sorusuna göre yukarıdaki verileri kullanarak yardımcı ol.`

        // Call OpenRouter API
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
                'X-Title': 'NeoList Task Manager'
            },
            body: JSON.stringify({
                model: FREE_MODELS[0], // NVIDIA Nemotron Nano 12B V2 VL - 128K context
                messages: [
                    { role: 'system', content: systemPrompt },
                    { 
                        role: 'user', 
                        content: images && images.length > 0 ? [
                            { type: 'text', text: message },
                            ...images.map((img: string) => ({ type: 'image_url', image_url: { url: img } }))
                        ] : message
                    }
                ],
                temperature: 0.7,
                max_tokens: 8000, // Leverage high context for detailed responses
                top_p: 0.9
            })
        })

        if (!openRouterResponse.ok) {
            const error = await openRouterResponse.text()
            console.error('OpenRouter API error:', error)
            return NextResponse.json(
                { 
                    error: 'AI service error', 
                    details: `OpenRouter API returned ${openRouterResponse.status}: ${error.substring(0, 200)}`
                },
                { status: openRouterResponse.status }
            )
        }

        const data = await openRouterResponse.json()
        const aiMessage = data.choices?.[0]?.message?.content || 'Üzgünüm, bir yanıt oluşturamadım.'

        return NextResponse.json({
            message: aiMessage,
            model: data.model,
            usage: data.usage
        })

    } catch (error: any) {
        console.error('AI Chat error:', error)
        return NextResponse.json(
            { error: 'AI chat failed', details: error.message },
            { status: 500 }
        )
    }
}
