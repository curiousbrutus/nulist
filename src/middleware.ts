export { auth as middleware } from '@/auth'

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - api/auth (NextAuth endpoints)
         */
        '/((?!_next/static|_next/image|favicon.ico|api/auth|api/telegram|api/zimbra|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
