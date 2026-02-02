import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters'
import { executeQuery, executeNonQuery } from './oracle'

/**
 * NextAuth.js v5 - Custom Oracle Adapter
 * 
 * Bu adapter Next-Auth'u Oracle DB ile entegre eder.
 * Profiles tablosu kullanıcı bilgilerini tutar.
 */

export function OracleAdapter(): Adapter {
    return {
        /**
         * Kullanıcı oluştur
         */
        async createUser(user): Promise<AdapterUser> {
            const id = crypto.randomUUID()

            await executeNonQuery(
                `INSERT INTO profiles (id, email, full_name, avatar_url) 
                 VALUES (:id, :email, :full_name, :avatar_url)`,
                {
                    id,
                    email: user.email,
                    full_name: user.name || null,
                    avatar_url: user.image || null
                }
            )

            return {
                id,
                email: user.email!,
                emailVerified: null,
                name: user.name || null,
                image: user.image || null
            }
        },

        /**
         * Kullanıcıyı ID ile getir
         */
        async getUser(id): Promise<AdapterUser | null> {
            const users = await executeQuery<any>(
                `SELECT id, email, full_name as name, avatar_url as image 
                 FROM profiles WHERE id = :id`,
                { id }
            )

            if (users.length === 0) return null

            const user = users[0]
            return {
                id: user.ID,
                email: user.EMAIL,
                emailVerified: null,
                name: user.NAME,
                image: user.IMAGE
            }
        },

        /**
         * Kullanıcıyı email ile getir
         */
        async getUserByEmail(email): Promise<AdapterUser | null> {
            const users = await executeQuery<any>(
                `SELECT id, email, full_name as name, avatar_url as image 
                 FROM profiles WHERE LOWER(email) = LOWER(:email)`,
                { email }
            )

            if (users.length === 0) return null

            const user = users[0]
            return {
                id: user.ID,
                email: user.EMAIL,
                emailVerified: null,
                name: user.NAME,
                image: user.IMAGE
            }
        },

        /**
         * Kullanıcıyı account ile getir (OAuth için - bizim projede kullanılmıyor)
         */
        async getUserByAccount({ providerAccountId, provider }): Promise<AdapterUser | null> {
            // OAuth kullanmıyoruz, bu method boş kalabilir
            return null
        },

        /**
         * Kullanıcı güncelle
         */
        async updateUser(user): Promise<AdapterUser> {
            await executeNonQuery(
                `UPDATE profiles 
                 SET email = :email, 
                     full_name = :name, 
                     avatar_url = :image
                 WHERE id = :id`,
                {
                    id: user.id,
                    email: user.email,
                    name: user.name || null,
                    image: user.image || null
                }
            )

            return user as AdapterUser
        },

        /**
         * Kullanıcı sil
         */
        async deleteUser(userId): Promise<void> {
            await executeNonQuery(
                `DELETE FROM profiles WHERE id = :id`,
                { id: userId }
            )
        },

        /**
         * Account oluştur (OAuth için - kullanılmıyor)
         */
        async linkAccount(account): Promise<AdapterAccount | null | undefined> {
            // Credentials provider kullanıyoruz, OAuth yok
            return undefined
        },

        /**
         * Account sil (OAuth için - kullanılmıyor)
         */
        async unlinkAccount({ providerAccountId, provider }): Promise<void> {
            // OAuth kullanılmıyor
        },

        /**
         * Session oluştur
         * Not: Credentials provider ile JWT strategy kullanıldığında bu method çağrılmaz
         */
        async createSession({ sessionToken, userId, expires }): Promise<AdapterSession> {
            // JWT strategy kullanıyoruz, database session'ları kullanmıyoruz
            return {
                sessionToken,
                userId,
                expires
            }
        },

        /**
         * Session getir
         */
        async getSessionAndUser(sessionToken): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
            // JWT strategy kullanıyoruz
            return null
        },

        /**
         * Session güncelle
         */
        async updateSession(session): Promise<AdapterSession | null | undefined> {
            // JWT strategy kullanıyoruz
            return undefined
        },

        /**
         * Session sil
         */
        async deleteSession(sessionToken): Promise<void> {
            // JWT strategy kullanıyoruz
        },

        /**
         * Verification token oluştur (Email verification için)
         */
        async createVerificationToken({ identifier, expires, token }): Promise<VerificationToken | null | undefined> {
            // Email verification kullanmıyoruz
            return undefined
        },

        /**
         * Verification token kullan
         */
        async useVerificationToken({ identifier, token }): Promise<VerificationToken | null> {
            // Email verification kullanmıyoruz
            return null
        }
    }
}
