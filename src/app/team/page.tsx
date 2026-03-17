'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Trophy, Users, Download, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TeamMember {
    id: string;
    name: string;
    department: string;
    department_name?: string | null;
    unit_name?: string | null;
    avatar_url: string;
    total_tasks: number;
    completed_tasks: number;
    ratio: number;
}

interface TeamResponse {
    stats: TeamMember[];
    filterOptions?: {
        departments: string[];
        units: Array<{ name: string; department: string }>;
        meetingTypes?: Array<{ name: string; total_tasks: number; completed_tasks: number; ratio: number }>;
    };
}

interface MemberTask {
    id: string;
    title: string;
    is_completed: boolean;
    due_date?: string;
    meeting_type?: string;
    list_title?: string;
    folder_title?: string;
}

export default function TeamPage() {
    const router = useRouter()
    const [stats, setStats] = useState<TeamMember[]>([])
    const [departments, setDepartments] = useState<string[]>([])
    const [units, setUnits] = useState<Array<{ name: string; department: string }>>([])
    const [meetingTypes, setMeetingTypes] = useState<Array<{ name: string; total_tasks: number; completed_tasks: number; ratio: number }>>([])
    const [selectedMeetingType, setSelectedMeetingType] = useState('')
    const [selectedDepartment, setSelectedDepartment] = useState('')
    const [selectedUnit, setSelectedUnit] = useState('')
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
    const [memberTasks, setMemberTasks] = useState<MemberTask[]>([])
    const [loadingMemberTasks, setLoadingMemberTasks] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const params = new URLSearchParams()
                if (selectedDepartment) params.set('department', selectedDepartment)
                if (selectedUnit) params.set('unit', selectedUnit)
                if (selectedMeetingType) params.set('meeting_type', selectedMeetingType)
                const endpoint = params.toString() ? `/api/stats/team?${params.toString()}` : '/api/stats/team'
                const res = await fetch(endpoint)
                if (res.ok) {
                    const data = await res.json() as TeamResponse | TeamMember[]
                    if (Array.isArray(data)) {
                        setStats(data)
                        setDepartments([])
                        setUnits([])
                        setMeetingTypes([])
                    } else {
                        setStats(data.stats || [])
                        setDepartments(data.filterOptions?.departments || [])
                        setUnits(data.filterOptions?.units || [])
                        setMeetingTypes(data.filterOptions?.meetingTypes || [])
                    }
                }
            } catch (error) {
                console.error('Failed to fetch stats', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [selectedDepartment, selectedUnit, selectedMeetingType])

    useEffect(() => {
        if (selectedDepartment && selectedUnit) {
            const selectedUnitMeta = units.find((item) => item.name === selectedUnit)
            if (selectedUnitMeta && selectedUnitMeta.department !== selectedDepartment) {
                setSelectedUnit('')
            }
        }
    }, [selectedDepartment, selectedUnit, units])

    const filteredUnits = selectedDepartment
        ? units.filter((unit) => unit.department === selectedDepartment)
        : units

    const loadMemberTasks = async (member: TeamMember) => {
        setSelectedMember(member)
        setLoadingMemberTasks(true)
        try {
            const params = new URLSearchParams({ user_id: member.id })
            if (selectedMeetingType) {
                params.set('meeting_type', selectedMeetingType)
            }
            const res = await fetch(`/api/stats/team/member?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setMemberTasks(Array.isArray(data.tasks) ? data.tasks : [])
            } else {
                setMemberTasks([])
            }
        } catch {
            setMemberTasks([])
        } finally {
            setLoadingMemberTasks(false)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="h-10 w-10 rounded-lg bg-[#FF671F] flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-[#00205B]">Ekip Performansı</h1>
                        <p className="text-muted-foreground text-sm uppercase tracking-wider font-medium">İş takibi ve başarı oranları</p>
                    </div>
                </div>

                <button
                    onClick={async () => {
                        try {
                            const params = new URLSearchParams()
                            if (selectedDepartment) params.set('department', selectedDepartment)
                            if (selectedUnit) params.set('unit', selectedUnit)
                            if (selectedMeetingType) params.set('meeting_type', selectedMeetingType)
                            
                            const res = await fetch(`/api/stats/team/export-tasks?${params.toString()}`)
                            if (!res.ok) throw new Error('Görevler alınamadı')
                            const data = await res.json()
                            
                            const XLSX = await import('xlsx')
                            const ws = XLSX.utils.json_to_sheet(data.tasks.map((t: any) => ({
                                'Görev Adı': t.task_title,
                                'Durum': t.is_completed ? 'Tamamlandı' : 'Devam Ediyor',
                                'Sorumlu': t.assignee_name || 'Atanmadı',
                                'Sorumlu Departmanı': t.assignee_department || 'Belirtilmedi',
                                'Kurul': t.meeting_type,
                                'Departman': t.folder_title,
                                'Liste / Birim': t.list_title,
                                'Atanma Tarihi': t.created_at,
                                'Termin Tarihi': t.due_date,
                            })))
                            
                            const wb = XLSX.utils.book_new()
                            XLSX.utils.book_append_sheet(wb, ws, "Görevler")
                            XLSX.writeFile(wb, `Filtrelenmis_Gorevler_${new Date().toLocaleDateString('tr-TR')}.xlsx`)
                        } catch (err) {
                            console.error('İndirme hatası', err)
                            alert('Görevler indirilirken bir hata oluştu.')
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600/90 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg text-sm font-semibold whitespace-nowrap"
                >
                    <Download className="h-4 w-4" />
                    Filtrelenmiş Görevleri İndir (.xlsx)
                </button>
            </header>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <select
                    value={selectedDepartment}
                    onChange={(e) => {
                        setSelectedDepartment(e.target.value)
                        setSelectedUnit('')
                    }}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                >
                    <option value="">Tüm Departmanlar</option>
                    {departments.map((department) => (
                        <option key={department} value={department}>
                            {department}
                        </option>
                    ))}
                </select>

                <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                >
                    <option value="">Tüm Birimler</option>
                    {filteredUnits.map((unit) => (
                        <option key={`${unit.department}-${unit.name}`} value={unit.name}>
                            {unit.name}
                        </option>
                    ))}
                </select>

                <select
                    value={selectedMeetingType}
                    onChange={(e) => setSelectedMeetingType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                >
                    <option value="">Tüm Kurullar</option>
                    {meetingTypes.map((meetingType) => (
                        <option key={meetingType.name} value={meetingType.name}>
                            {meetingType.name} ({meetingType.completed_tasks}/{meetingType.total_tasks})
                        </option>
                    ))}
                </select>
            </div>

            {meetingTypes.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    {meetingTypes.map((meetingType) => (
                        <button
                            key={meetingType.name}
                            type="button"
                            onClick={() => setSelectedMeetingType((current) => current === meetingType.name ? '' : meetingType.name)}
                            className={`text-left rounded-xl border p-3 transition ${selectedMeetingType === meetingType.name ? 'border-[#00205B] bg-[#00205B]/5' : 'border-muted bg-card hover:bg-muted/30'}`}
                        >
                            <p className="text-sm font-semibold truncate">{meetingType.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{meetingType.completed_tasks}/{meetingType.total_tasks} tamamlandı • %{meetingType.ratio}</p>
                        </button>
                    ))}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stats.map((member, index) => (
                    <Card key={member.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 group cursor-pointer" onClick={() => loadMemberTasks(member)}>
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

            {selectedMember && (
                <Card className="border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                        <CardTitle className="text-base text-[#00205B]">
                            {selectedMember.name} • Detaylı Görev Listesi {selectedMeetingType ? `(${selectedMeetingType})` : ''}
                        </CardTitle>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            onClick={async () => {
                                try {
                                    const params = new URLSearchParams()
                                    params.set('user_id', selectedMember.id)
                                    if (selectedMeetingType) params.set('meeting_type', selectedMeetingType)
                                    
                                    const res = await fetch(`/api/stats/team/export-tasks?${params.toString()}`)
                                    if (!res.ok) throw new Error('Görevler alınamadı')
                                    const data = await res.json()
                                    
                                    const XLSX = await import('xlsx')
                                    const ws = XLSX.utils.json_to_sheet(data.tasks.map((t: any) => ({
                                        'Görev Adı': t.task_title,
                                        'Durum': t.is_completed ? 'Tamamlandı' : 'Devam Ediyor',
                                        'Kurul': t.meeting_type,
                                        'Departman': t.folder_title,
                                        'Liste / Birim': t.list_title,
                                        'Atanma Tarihi': t.created_at,
                                        'Termin Tarihi': t.due_date,
                                    })))
                                    
                                    const wb = XLSX.utils.book_new()
                                    XLSX.utils.book_append_sheet(wb, ws, selectedMember.name.substring(0, 30))
                                    XLSX.writeFile(wb, `${selectedMember.name.replace(/\s+/g, '_')}_Gorevleri.xlsx`)
                                } catch (err) {
                                    console.error('İndirme hatası', err)
                                    alert('Görevler indirilirken bir hata oluştu.')
                                }
                            }}
                        >
                            <Download className="h-4 w-4 mr-2" /> 
                            Kullanıcının Görevlerini İndir
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-muted text-foreground rounded-full text-xs font-semibold border">
                                Toplam: {memberTasks.length}
                            </span>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
                                Tamamlanan: {memberTasks.filter(t => t.is_completed).length}
                            </span>
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold border border-amber-200">
                                Devam Eden: {memberTasks.filter(t => !t.is_completed).length}
                            </span>
                            <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-semibold border border-rose-200">
                                Geciken: {memberTasks.filter(t => !t.is_completed && t.due_date && new Date(t.due_date) < new Date()).length}
                            </span>
                        </div>
                        {loadingMemberTasks ? (
                            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
                        ) : memberTasks.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Görev bulunamadı.</p>
                        ) : (
                            memberTasks.map((task) => {
                                const isOverdue = !task.is_completed && task.due_date && new Date(task.due_date) < new Date()
                                return (
                                <div key={task.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${isOverdue ? 'border-rose-200 bg-rose-50/50' : ''}`}>
                                    <div>
                                        <p className="font-medium">{task.title}</p>
                                        <p className="text-xs text-muted-foreground">{task.folder_title || '-'} / {task.list_title || '-'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={task.is_completed ? 'text-emerald-600 text-xs font-semibold' : (isOverdue ? 'text-rose-600 text-xs font-semibold' : 'text-amber-600 text-xs font-semibold')}>
                                            {task.is_completed ? 'Tamamlandı' : (isOverdue ? 'Gecikti' : 'Devam Ediyor')}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {task.due_date ? new Date(task.due_date).toLocaleDateString('tr-TR') : '-'}
                                        </p>
                                    </div>
                                </div>
                                )
                            })
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
