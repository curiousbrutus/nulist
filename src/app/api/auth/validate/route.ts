import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { executeQuery, executeNonQuery } from '@/lib/oracle'
import { authenticateWithZimbra } from '@/lib/zimbra-sync'

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

        // 1. Önce veritabanında kullanıcıyı ara (Fuzzy email matching)
        // fatih-sak@... ile fatihsak@... eşleşmeli
        const users = await executeQuery<any>(
            `SELECT id, email, full_name, avatar_url, password_hash, role 
             FROM profiles 
             WHERE LOWER(email) = LOWER(:email)
                OR REPLACE(LOWER(email), '-', '') = REPLACE(LOWER(:email), '-', '')`,
            { email: email as string }
        )

        let user = users[0]
        let isValid = false

        if (user && user.PASSWORD_HASH) {
            // Veritabanında varsa ve şifre hash'i varsa kontrol et
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

                // Try to authenticate with Zimbra using user's actual credentials
                const zimbraAuth = await authenticateWithZimbra(email as string, password as string)

                if (zimbraAuth) {
                    isValid = true

                    // Eğer kullanıcı veritabanında yoksa yeni profil oluştur (Auto-provisioning)
                    if (!user) {
                        const newId = crypto.randomUUID()
                        const passwordHash = await hash(password, 10)
                        
                        // Parse name from email better
                        const emailNamePart = email.split('@')[0]
                        // fatih.sak -> Fatih Sak, fatih-sak -> Fatih Sak, fatihsak -> Fatihsak
                        const formattedName = emailNamePart
                            .replace(/[.-]/g, ' ')
                            .split(' ')
                            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ')

                        await executeNonQuery(
                            `INSERT INTO profiles (id, email, full_name, password_hash, role, zimbra_sync_enabled)
                             VALUES (:id, :email, :full_name, :password_hash, 'user', 1)`,
                            {
                                id: newId,
                                email: email.toLowerCase(),
                                full_name: formattedName,
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
