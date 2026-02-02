import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { executeNonQuery } from '@/lib/oracle'

// Force Node.js runtime for OracleDB
export const runtime = 'nodejs'


export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, fullName } = body

        // Validasyon
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email ve şifre gereklidir' },
                { status: 400 }
            )
        }

        // Email formatı kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Geçersiz email formatı' },
                { status: 400 }
            )
        }

        // Şifre uzunluğu kontrolü
        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Şifre en az 6 karakter olmalıdır' },
                { status: 400 }
            )
        }

        // Şifreyi hashle
        const passwordHash = await hash(password, 10)
        const userId = crypto.randomUUID()

        // Kullanıcıyı oluştur
        await executeNonQuery(
            `INSERT INTO profiles (id, email, full_name, password_hash) 
             VALUES (:id, :email, :full_name, :password_hash)`,
            {
                id: userId,
                email: email.toLowerCase(),
                full_name: fullName || null,
                password_hash: passwordHash
            }
        )

        return NextResponse.json({
            success: true,
            user: {
                id: userId,
                email: email.toLowerCase(),
                fullName: fullName || null
            }
        })

    } catch (error: any) {
        console.error('Register error:', error)

        // Oracle unique constraint hatası
        if (error.errorNum === 1) {
            return NextResponse.json(
                { error: 'Bu email adresi zaten kullanılıyor' },
                { status: 409 }
            )
        }

        return NextResponse.json(
            { error: 'Kayıt sırasında bir hata oluştu' },
            { status: 500 }
        )
    }
}
