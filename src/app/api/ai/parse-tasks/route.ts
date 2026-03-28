import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

const OLLAMA_BASE_URL = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b'

const SYSTEM_PROMPT = `Sen bir görev listesi ayrıştırıcısısın. Kullanıcının verdiği serbest metin girişini alıp yapılandırılmış görev listesine dönüştürürsün.

ÇIKTI FORMATI: Yalnızca geçerli JSON döndür, başka hiçbir şey yok.
Şema:
{
  "tasks": [
    {
      "title": "Görev adı (zorunlu, özlü)",
      "description": "Açıklama (isteğe bağlı)",
      "priority": "Düşük|Orta|Yüksek|Acil",
      "due_date_str": "GG.AA.YYYY veya boş",
      "assignees": "Ad Soyad, Ad Soyad (virgülle ayrılmış veya boş)"
    }
  ]
}

KURALLAR:
- Her satır veya madde işareti genellikle ayrı bir görevdir
- Önceliği bağlamdan çıkar (acil, önemli, yüksek öncelik → "Acil" veya "Yüksek")
- Varsayılan öncelik: "Orta"
- Tarihleri GG.AA.YYYY formatına dönüştür; bilin tarih yoksa boş bırak
- İsimler metinde geçiyorsa atananlar alanına ekle
- JSON dışında HİÇBİR ŞEY yazma, açıklama yok, markdown yok`

// POST /api/ai/parse-tasks - AI ile serbest metin → yapılandırılmış görev
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { text } = body

        if (!text || typeof text !== 'string' || !text.trim()) {
            return NextResponse.json({ error: 'text is required' }, { status: 400 })
        }

        const ollamaBody = {
            model: OLLAMA_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: text.trim() }
            ],
            stream: false,
            options: {
                temperature: 0.1,       // Deterministik JSON için düşük sıcaklık
                num_predict: 1024,
                num_ctx: 4096
            }
        }

        const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ollamaBody),
            signal: AbortSignal.timeout(120000)
        })

        if (!ollamaRes.ok) {
            console.error('Ollama parse-tasks error:', ollamaRes.status)
            return NextResponse.json({ error: 'AI servisi geçici olarak kullanılamıyor' }, { status: 503 })
        }

        const ollamaData = await ollamaRes.json()
        const rawContent: string = ollamaData?.message?.content || ''

        // JSON bloğunu çıkar (AI bazen ```json ... ``` ile sarabilir)
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.error('AI returned no valid JSON:', rawContent.slice(0, 300))
            return NextResponse.json({ error: 'AI geçerli görev verisi döndürmedi' }, { status: 422 })
        }

        let parsed: { tasks: any[] }
        try {
            parsed = JSON.parse(jsonMatch[0])
        } catch (parseErr) {
            console.error('JSON parse failed:', jsonMatch[0].slice(0, 300))
            return NextResponse.json({ error: 'AI çıktısı ayrıştırılamadı' }, { status: 422 })
        }

        if (!Array.isArray(parsed?.tasks)) {
            return NextResponse.json({ error: 'Geçersiz AI çıktısı' }, { status: 422 })
        }

        // Sanitize tasks
        const tasks = parsed.tasks
            .filter((t: any) => t?.title && String(t.title).trim().length > 0)
            .map((t: any) => ({
                title: String(t.title || '').trim(),
                description: String(t.description || '').trim(),
                priority: ['Düşük', 'Orta', 'Yüksek', 'Acil'].includes(t.priority) ? t.priority : 'Orta',
                due_date_str: String(t.due_date_str || '').trim(),
                assignees: String(t.assignees || '').trim()
            }))

        return NextResponse.json({ tasks })
    } catch (error: any) {
        if (error?.name === 'TimeoutError') {
            return NextResponse.json({ error: 'AI zaman aşımı — metin çok uzun olabilir' }, { status: 503 })
        }
        console.error('POST /api/ai/parse-tasks error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
