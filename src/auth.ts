import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'

export const authConfig: NextAuthConfig = {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret-key-change-in-production',
    basePath: '/api/auth',
    trustHost: true, // Trust localhost and network hosts
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                // IMPORTANT: OracleDB sadece API route'larında kullanılacak
                // Middleware Edge Runtime'da çalıştığı için burada kullanılamaz
                // Bu yüzden auth kontrolü API route'unda yapılacak

                // API route'una istek at
                const apiUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
                const response = await fetch(`${apiUrl}/api/auth/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: credentials.email,
                        password: credentials.password
                    })
                })

                if (!response.ok) {
                    return null
                }

                const user = await response.json()
                return user
            }
        })
    ],
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60 // 30 gün
    },
    pages: {
        signIn: '/login'
    },
    callbacks: {
        async authorized({ auth, request }) {
            const { pathname } = request.nextUrl
            const isLoggedIn = !!auth?.user

            // Public paths
            const publicPaths = ['/login', '/api/auth']
            const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

            if (isPublicPath) {
                if (pathname === '/login' && isLoggedIn) {
                    return Response.redirect(new URL('/', request.url))
                }
                return true
            }

            if (!isLoggedIn) {
                return Response.redirect(new URL('/login', request.url))
            }

            return true
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.email = user.email
                token.name = user.name
                token.picture = user.image
                token.role = (user as any).role
            }
            return token
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string
                session.user.email = token.email as string
                session.user.name = token.name as string
                session.user.image = token.picture as string
                (session.user as any).role = token.role as string
            }
            return session
        }
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
export const { GET, POST } = handlers
