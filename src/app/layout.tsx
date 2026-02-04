import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import ThemeWatcher from '@/components/layout/ThemeWatcher'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NeoList - Modern Görev Yönetimi',
  description: "Wunderlist'in basitliği, modern teknolojinin gücüyle birleşti.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <ThemeWatcher />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
