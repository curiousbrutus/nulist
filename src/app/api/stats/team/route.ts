import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/oracle';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let connection;

    try {
        connection = await getConnection();
                const { searchParams } = new URL(request.url);
                const department = (searchParams.get('department') || '').trim() || null;
                const unit = (searchParams.get('unit') || '').trim() || null;

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
            GROUP BY p.id, p.full_name, p.department, p.avatar_url, NVL(pf.title, f.title), CASE WHEN f.parent_id IS NULL THEN NULL ELSE f.title END
      ORDER BY total_tasks DESC
    `;

                const result = await connection.execute(sql, { department, unit });

                const filterSql = `
            SELECT DISTINCT
                NVL(pf.title, f.title) as department_name,
                CASE WHEN f.parent_id IS NULL THEN NULL ELSE f.title END as unit_name
            FROM folders f
            LEFT JOIN folders pf ON f.parent_id = pf.id
            WHERE NVL(pf.title, f.title) IS NOT NULL
            ORDER BY NVL(pf.title, f.title), CASE WHEN f.parent_id IS NULL THEN NULL ELSE f.title END
        `;

                const filterRows = await connection.execute(filterSql);
                const departments = Array.from(
                        new Set((filterRows.rows || []).map((row: any) => row[0]).filter(Boolean))
                );
                const units = (filterRows.rows || [])
                        .filter((row: any) => Boolean(row[1]))
                        .map((row: any) => ({
                                name: row[1],
                                department: row[0]
                        }));

        // Map array rows to objects
        const stats = (result.rows || []).map((row: any) => {
            const total = row[4] || 0;
            const completed = row[5] || 0;
            const ratio = total > 0 ? Math.round((completed / total) * 100) : 0;

            return {
                id: row[0],
                name: row[1],
                department: row[2] || 'Belirtilmedi',
                avatar_url: row[3],
                total_tasks: total,
                completed_tasks: completed,
                ratio: ratio,
                department_name: row[6] || null,
                unit_name: row[7] || null
            };
        });

        return NextResponse.json({
            stats,
            filterOptions: {
                departments,
                units
            }
        });

    } catch (error: any) {
        console.error('Stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}
