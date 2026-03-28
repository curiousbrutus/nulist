import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery } from '@/lib/oracle'

export const runtime = 'nodejs'

const OLLAMA_BASE_URL = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b'
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || '256')
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || '4096')
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || '0.3')

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

        // Get comprehensive task context
        let contextData = ''
        let userTasksData = ''
        
        // Get tasks from current list if provided
        if (context?.list_id) {
            try {
            const listTasks = await executeQuery(
                `SELECT t.title, t.notes, t.priority, t.due_date, t.is_completed,
                        (SELECT LISTAGG(p.full_name, ', ') WITHIN GROUP (ORDER BY p.full_name)
                         FROM task_assignees ta 
                         JOIN profiles p ON ta.user_id = p.id
                         WHERE ta.task_id = t.id) as assignees,
                        l.title as list_name
                 FROM tasks t
                 LEFT JOIN lists l ON t.list_id = l.id
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
            } catch (queryError: any) {
                console.error('AI Chat - list tasks query error:', queryError.message)
                // Graceful degradation - continue without list context
            }
        }
        
        // Get user's own assigned tasks (LEFT JOIN to avoid VPD/NULL issues)
        try {
            const myTasks = await executeQuery(
                `SELECT t.title, t.priority, t.due_date, t.is_completed,
                        l.title as list_name,
                        f.title as folder_name
                 FROM tasks t
                 JOIN task_assignees ta ON t.id = ta.task_id
                 LEFT JOIN lists l ON t.list_id = l.id
                 LEFT JOIN folders f ON l.folder_id = f.id
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
                    const folder = t.folder_name || t.FOLDER_NAME || ''
                    const list = t.list_name || t.LIST_NAME || ''
                    const location = folder && list ? `(${folder} > ${list})` : list ? `(${list})` : ''
                    const dueDate = t.due_date || t.DUE_DATE
                    const dueDateStr = dueDate ? `, Bitiş: ${new Date(dueDate).toLocaleDateString('tr-TR')}` : ''
                    return `• ${title} ${location}\n  Öncelik: ${priority}${dueDateStr}`
                }).join('\n')
            }
        } catch (queryError: any) {
            console.error('AI Chat - user tasks query error:', queryError.message)
            // Graceful degradation - continue without user task context
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

        const userContent = images && images.length > 0
            ? `${message}\n\nNot: Görsel analizi şu an bu modelde pasif, sadece metin üzerinden cevap ver.`
            : message

        let ollamaResponse: Response
        try {
            ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    stream: false,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ],
                    options: {
                        temperature: OLLAMA_TEMPERATURE,
                        top_p: 0.9,
                        num_predict: OLLAMA_NUM_PREDICT,
                        num_ctx: OLLAMA_NUM_CTX
                    }
                }),
                signal: AbortSignal.timeout(120000)
            })
        } catch (networkError: any) {
            return NextResponse.json(
                {
                    error: 'AI service unavailable',
                    details: `Ollama erişilemedi (${OLLAMA_BASE_URL}). Servisi başlatın: ollama serve`
                },
                { status: 503 }
            )
        }

        if (!ollamaResponse.ok) {
            const error = await ollamaResponse.text()
            console.error('Ollama API error:', error)
            return NextResponse.json(
                {
                    error: 'AI service error',
                    details: `Ollama ${ollamaResponse.status}: ${error.substring(0, 300)}`
                },
                { status: ollamaResponse.status }
            )
        }

        const data = await ollamaResponse.json()
        const aiMessage = data?.message?.content || 'Üzgünüm, bir yanıt oluşturamadım.'

        return NextResponse.json({
            message: aiMessage,
            model: data?.model || OLLAMA_MODEL,
            usage: {
                prompt_eval_count: data?.prompt_eval_count,
                eval_count: data?.eval_count,
                total_duration: data?.total_duration
            }
        })

    } catch (error: any) {
        console.error('AI Chat error:', error)
        return NextResponse.json(
            { error: 'AI servisinde bir sorun oluştu', details: 'Lütfen tekrar deneyin veya yöneticinize bildirin.' },
            { status: 500 }
        )
    }
}
