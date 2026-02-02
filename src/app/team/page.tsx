'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Trophy, Users, BarChart, Download } from 'lucide-react'

interface TeamMember {
    id: string;
    name: string;
    department: string;
    avatar_url: string;
    total_tasks: number;
    completed_tasks: number;
    ratio: number;
}

export default function TeamPage() {
    const [stats, setStats] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/stats/team')
                if (res.ok) {
                    const data = await res.json()
                    setStats(data)
                }
            } catch (error) {
                console.error('Failed to fetch stats', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#FF671F] flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-[#00205B]">Ekip Performansı</h1>
                        <p className="text-muted-foreground text-sm uppercase tracking-wider font-medium">İş takibi ve başarı oranları</p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        const headers = "Ad Soyad,Departman,Toplam Görev,Tamamlanan,Başarı Oranı\n";
                        const csv = stats.map(m => `${m.name},${m.department},${m.total_tasks},${m.completed_tasks},%${m.ratio}`).join("\n");
                        const blob = new Blob(["\ufeff" + headers + csv], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.setAttribute("download", `Ekip_Performans_Raporu_${new Date().toLocaleDateString('tr-TR')}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00205B] text-white rounded-xl hover:bg-[#003399] transition-all shadow-lg text-sm font-semibold"
                >
                    <Download className="h-4 w-4" />
                    Raporu İndir (.csv)
                </button>
            </header>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stats.map((member, index) => (
                    <Card key={member.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#00205B] group-hover:bg-[#FF671F] transition-colors" />
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 border-2 border-[#00205B]/10">
                                        <AvatarImage src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=00205B&color=fff&bold=true`} />
                                        <AvatarFallback className="bg-[#00205B] text-white font-bold">
                                            {member.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-bold text-[#00205B]">{member.name}</h3>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-0.5 rounded-full mt-1">
                                            {member.department || 'Belirtilmedi'}
                                        </p>
                                    </div>
                                </div>
                                {index < 3 && (
                                    <Trophy className={`h-6 w-6 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-amber-600'}`} />
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Tamamlanan Görevler</span>
                                    <span className="font-bold text-[#00205B]">{member.completed_tasks} / {member.total_tasks}</span>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className={member.ratio >= 80 ? 'text-emerald-600' : 'text-muted-foreground'}>Başarı Oranı</span>
                                        <span className={member.ratio >= 80 ? 'text-emerald-600' : 'text-[#FF671F]'}>%{member.ratio}</span>
                                    </div>
                                    <Progress
                                        value={member.ratio}
                                        className="h-2"
                                        // Note: We need to style the progress indicator color dynamically if possible, or use a class
                                        indicatorClassName={member.ratio >= 100 ? 'bg-emerald-500' : 'bg-[#FF671F]'}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
