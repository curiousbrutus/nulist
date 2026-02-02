import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { getCalDAVClient } from '@/lib/zimbra-sync'
import dav from 'dav'

// Force Node.js runtime for OracleDB
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password } = body

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email ve şifre gereklidir' },
                { status: 400 }
            )
        }

        // 1. Önce veritabanında kullanıcıyı ara
        const users = await executeQuery<any>(
            `SELECT id, email, full_name, avatar_url, password_hash, role 
             FROM profiles 
             WHERE LOWER(email) = LOWER(:email)`,
            { email: email as string }
        )

        let user = users[0]
        let isValid = false

        if (user) {
            // Veritabanında varsa şifreyi kontrol et
            isValid = await compare(
                password as string,
                user.PASSWORD_HASH || user.password_hash
            )
        }

        // 2. Veritabanı doğrulaması başarısızsa veya kullanıcı yoksa Zimbra'yı dene
        if (!isValid) {
            try {
                // Kurumsal sertifika sorunları için TLS kontrolünü devre dışı bırak
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

                const client = await getCalDAVClient(email, password)
                // Zimbra'ya bağlanmayı dene (Account discovery bir nevi auth testi olur)
                const account = await dav.createAccount({
                    server: process.env.ZIMBRA_CALDAV_URL || 'https://zimbra.hospital.com:443/dav/',
                    xhr: client.xhr,
                    accountType: 'caldav',
                    loadObjects: false
                })

                if (account) {
                    isValid = true

                    // Eğer kullanıcı veritabanında yoksa yeni profil oluştur (Auto-provisioning)
                    if (!user) {
                        const newId = crypto.randomUUID()
                        const passwordHash = await hash(password, 10)

                        await executeNonQuery(
                            `INSERT INTO profiles (id, email, full_name, password_hash, role) 
                             VALUES (:id, :email, :full_name, :password_hash, 'user')`,
                            {
                                id: newId,
                                email: email.toLowerCase(),
                                full_name: email.split('@')[0], // Geçici ad
                                password_hash: passwordHash
                            }
                        )

                        // Yeni oluşturulan kullanıcıyı tekrar çek
                        const newUsers = await executeQuery<any>(
                            `SELECT id, email, full_name, avatar_url, role FROM profiles WHERE id = :id`,
                            { id: newId }
                        )
                        user = newUsers[0]
                    }
                }
            } catch (zimbraError: any) {
                console.error(`❌ Zimbra auth failed for ${email}:`, {
                    message: zimbraError.message,
                    status: zimbraError.status,
                    response: zimbraError.response?.substring?.(0, 200)
                })
            }
        }

        if (!isValid || !user) {
            return NextResponse.json(
                { error: 'Geçersiz email veya şifre' },
                { status: 401 }
            )
        }

        // Kullanıcı bilgilerini döndür (NextAuth için)
        return NextResponse.json({
            id: user.ID || user.id,
            email: user.EMAIL || user.email,
            name: user.FULL_NAME || user.full_name,
            image: user.AVATAR_URL || user.avatar_url,
            role: user.ROLE || user.role || 'user'
        })

    } catch (error: any) {
        console.error('Validate error:', error)
        return NextResponse.json(
            { error: 'Doğrulama sırasında bir hata oluştu' },
            { status: 500 }
        )
    }
}
