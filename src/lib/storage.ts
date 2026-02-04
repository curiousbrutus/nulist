import path from 'path'
import fs from 'fs/promises'

// Storage Service Interface
export interface IStorageService {
    upload(file: File, filePath: string): Promise<string>
    delete(filePath: string): Promise<void>
    getPublicUrl(filePath: string): string
}

// Local Storage Service - Dosyaları public/uploads klasörüne kaydeder
export class LocalStorageService implements IStorageService {
    private basePath = './public/uploads'

    async upload(file: File, filePath: string): Promise<string> {
        const buffer = Buffer.from(await file.arrayBuffer())
        const fullPath = path.join(this.basePath, filePath)

        // Klasör yoksa oluştur
        const dir = path.dirname(fullPath)
        await fs.mkdir(dir, { recursive: true })

        // Dosyayı yaz
        await fs.writeFile(fullPath, buffer)

        return filePath
    }

    async delete(filePath: string): Promise<void> {
        const fullPath = path.join(this.basePath, filePath)
        try {
            await fs.unlink(fullPath)
        } catch (error) {
            // Dosya zaten silinmişse hata verme
            console.warn('Dosya silinemedi veya bulunamadı:', filePath)
        }
    }

    getPublicUrl(filePath: string): string {
        return `/uploads/${filePath}`
    }
}

// Storage type'a göre doğru servisi döner
export function getStorageService(): IStorageService {
    // Supabase kaldırıldığı için her zaman LocalStorageService döner
    return new LocalStorageService()
}

// Dosya validasyonu için yardımcı fonksiyonlar
export function getMaxFileSize(): number {
    return parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760', 10) // 10MB default
}

export function getAllowedFileTypes(): string[] {
    const types = process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES || ''
    return types.split(',').filter(Boolean)
}

export function isFileTypeAllowed(mimeType: string): boolean {
    const allowedTypes = getAllowedFileTypes()
    if (allowedTypes.length === 0) return true // Boşsa her şey izinli
    return allowedTypes.includes(mimeType)
}

export function isFileSizeAllowed(size: number): boolean {
    return size <= getMaxFileSize()
}

// Dosya uzantısından icon belirle
export function getFileIcon(fileType: string): string {
    if (fileType.startsWith('image/')) return '🖼️'
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊'
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦'
    if (fileType.includes('text')) return '📃'
    return '📎'
}

// Dosya boyutunu okunabilir formata çevir
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Benzersiz dosya adı oluştur
export function generateUniqueFileName(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase()
    const baseName = path.basename(originalName, path.extname(originalName))
    const sanitizedBaseName = sanitizeFileName(baseName)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${sanitizedBaseName}-${timestamp}-${random}${ext}`
}

// Dosya adını güvenli hale getir (Supabase Storage için)
export function sanitizeFileName(fileName: string): string {
    // Türkçe karakterleri ASCII'ye çevir
    const turkishMap: Record<string, string> = {
        'ç': 'c', 'Ç': 'C',
        'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'I': 'I',
        'İ': 'I', 'i': 'i',
        'ö': 'o', 'Ö': 'O',
        'ş': 's', 'Ş': 'S',
        'ü': 'u', 'Ü': 'U'
    }

    let sanitized = fileName

    // Türkçe karakterleri değiştir
    for (const [turkish, ascii] of Object.entries(turkishMap)) {
        sanitized = sanitized.replace(new RegExp(turkish, 'g'), ascii)
    }

    // Sadece alfanumerik, tire ve alt çizgi karakterlerini tut
    // Diğer tüm karakterleri alt çizgiye çevir
    sanitized = sanitized
        .replace(/[^a-zA-Z0-9\-_]/g, '_') // Özel karakterleri _ yap
        .replace(/_+/g, '_')              // Birden fazla _ karakterini teke indir
        .replace(/^_|_$/g, '')            // Baş ve sondaki _ karakterlerini kaldır
        .toLowerCase()                     // Küçük harfe çevir

    // Boş kaldıysa varsayılan ad ver
    if (!sanitized) {
        sanitized = 'file'
    }

    return sanitized
}

