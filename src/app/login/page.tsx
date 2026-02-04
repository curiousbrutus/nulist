'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const { showToast } = useToast()
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false
            })

            if (result?.error) {
                showToast('Email veya şifre hatalı', 'error')
            } else {
                showToast('Başarıyla giriş yapıldı', 'success')
                router.push('/')
            }
        } catch (error) {
            showToast('Giriş sırasında bir hata oluştu', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, fullName })
            })

            const data = await response.json()

            if (!response.ok) {
                showToast(data.error || 'Kayıt başarısız', 'error')
                return
            }

            showToast('Kayıt başarılı! Giriş yapılıyor...', 'success')

            // Otomatik login
            await signIn('credentials', {
                email,
                password,
                redirect: false
            })

            router.push('/')
        } catch (error) {
            showToast('Kayıt sırasında bir hata oluştu', 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
            <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-2xl border shadow-xl">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">NeoList</h1>
                    <p className="text-muted-foreground mt-2">Optimed Hastanesi Görev Yönetim Sistemi</p>
                </div>

                <div className="space-y-4">
                    <Button
                        onClick={() => {
                            showToast('Lütfen kurumsal e-posta ve şifrenizi aşağıya girin', 'info')
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-xl transition-all"
                    >
                        Zimbra Kurumsal Girişi
                    </Button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t"></div>
                        <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase">veya</span>
                        <div className="flex-grow border-t"></div>
                    </div>

                    <form className="space-y-4" onSubmit={isSignUp ? handleSignUp : handleLogin}>
                        {isSignUp && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Ad Soyad</label>
                                <Input
                                    type="text"
                                    placeholder="Adınız Soyadınız"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Kurumsal E-posta</label>
                            <Input
                                type="email"
                                placeholder="ad.soyad@optimedhastanesi.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Şifre</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-2 pt-4">
                            <Button type="submit" disabled={loading} className="w-full py-6 text-lg">
                                {loading ? 'Kontrol ediliyor...' : (isSignUp ? 'Kaydol' : 'Giriş Yap')}
                            </Button>
                            {!isSignUp && (
                                <p className="text-xs text-center text-muted-foreground mt-2">
                                    Zimbra hesabınızla ilk kez giriş yapıyorsanız,<br />
                                    profiliniz otomatik olarak oluşturulacaktır.
                                </p>
                            )}
                            <Button
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                variant="ghost"
                                className="w-full text-sm"
                                disabled={loading}
                            >
                                {isSignUp ? 'Zaten hesabım var, giriş yap' : 'Hesabınız yok mu? Personel kaydı oluşturun'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
