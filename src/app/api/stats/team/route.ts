import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/oracle';
import { auth } from '@/auth';
import { requireManagerRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Yönetici rolü gerekli (admin/superadmin/secretary)
    const access = await requireManagerRole(session.user.id);
    if (!access.allowed) {
        return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const department = (searchParams.get('department') || '').trim() || null;
        const unit = (searchParams.get('unit') || '').trim() || null;
        const meetingType = (searchParams.get('meeting_type') || '').trim() || null;

        const sql = `
      SELECT 
        p.id,
        p.full_name,
        p.department,
        p.avatar_url,
        COUNT(ta.task_id) as total_tasks,
                SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
                NVL(pf.title, f.title) as department_name,
                CASE WHEN f.parent_id IS NULL THEN NULL ELSE f.title END as unit_name
      FROM profiles p
      LEFT JOIN task_assignees ta ON p.id = ta.user_id
      LEFT JOIN tasks t ON ta.task_id = t.id
            LEFT JOIN lists l ON t.list_id = l.id
            LEFT JOIN folders f ON l.folder_id = f.id
            LEFT JOIN folders pf ON f.parent_id = pf.id
      WHERE p.email NOT LIKE '%temp.local' -- Exclude placeholder users if any remaining
      AND p.full_name != 'Optimed Admin'
            AND (:department IS NULL OR NVL(pf.title, f.title) = :department)
            AND (:unit IS NULL OR (CASE WHEN f.parent_id IS NULL THEN f.title ELSE f.title END) = :unit)
            AND (:meeting_type IS NULL OR NVL(t.meeting_type, 'Genel') = :meeting_type)
            GROUP BY p.id, p.full_name, p.department, p.avatar_url, NVL(pf.title, f.title), CASE WHEN f.parent_id IS NULL THEN NULL ELSE f.title END
      ORDER BY total_tasks DESC
    `;

        // Use executeQuery helper for better safety and object mapping
        const stats = await executeQuery(sql, { 
            department, 
            unit, 
            meeting_type: meetingType 
        }, session.user.id);

        const filterSql = `
            SELECT DISTINCT
                NVL(pf.title, f.title) as department_name,
                CASE WHEN f.parent_id IS NULL THEN NULL ELSE f.title END as unit_name
            FROM folders f
            LEFT JOIN folders pf ON f.parent_id = pf.id
            WHERE NVL(pf.title, f.title) IS NOT NULL
            ORDER BY NVL(pf.title, f.title), CASE WHEN f.parent_id IS NULL THEN NULL ELSE f.title END
        `;

        const filterRows = await executeQuery(filterSql, {}, session.user.id);
        const departments = Array.from(
            new Set(filterRows.map((row: any) => row.department_name).filter(Boolean))
        );
        const units = filterRows
            .filter((row: any) => Boolean(row.unit_name))
            .map((row: any) => ({
                name: row.unit_name,
                department: row.department_name
            }));

        const meetingTypes = await executeQuery(
            `SELECT NVL(t.meeting_type, 'Genel') AS meeting_type,
                    COUNT(DISTINCT t.id) AS total_tasks,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) AS completed_tasks
             FROM tasks t
             LEFT JOIN lists l ON t.list_id = l.id
             LEFT JOIN folders f ON l.folder_id = f.id
             LEFT JOIN folders pf ON f.parent_id = pf.id
             WHERE (:department IS NULL OR NVL(pf.title, f.title) = :department)
               AND (:unit IS NULL OR (CASE WHEN f.parent_id IS NULL THEN f.title ELSE f.title END) = :unit)
             GROUP BY NVL(t.meeting_type, 'Genel')
             ORDER BY total_tasks DESC`,
            { department, unit },
            session.user.id
        );

        const formattedMeetingTypes = meetingTypes.map((row: any) => {
            const total = Number(row.total_tasks || 0);
            const completed = Number(row.completed_tasks || 0);
            return {
                name: row.meeting_type,
                total_tasks: total,
                completed_tasks: completed,
                ratio: total > 0 ? Math.round((completed / total) * 100) : 0
            };
        });

        const formattedStats = stats.map((row: any) => {
            const total = Number(row.total_tasks || 0);
            const completed = Number(row.completed_tasks || 0);
            return {
                id: row.id,
                name: row.full_name,
                department: row.department || 'Belirtilmedi',
                avatar_url: row.avatar_url,
                total_tasks: total,
                completed_tasks: completed,
                ratio: total > 0 ? Math.round((completed / total) * 100) : 0,
                department_name: row.department_name || null,
                unit_name: row.unit_name || null
            };
        });

        return NextResponse.json({
            stats: formattedStats,
            filterOptions: {
                departments,
                units,
                meetingTypes: formattedMeetingTypes
            },
            selectedFilters: {
                department,
                unit,
                meeting_type: meetingType
            }
        });

    } catch (error: any) {
        console.error('Stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
