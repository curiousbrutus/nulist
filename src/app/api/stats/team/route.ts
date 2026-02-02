import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/oracle';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let connection;

    try {
        connection = await getConnection();

        // Query to get task counts per user
        // We count tasks where the user is an assignee (primary or secondary)
        // We join with profiles to get names and departments
        const sql = `
      SELECT 
        p.id,
        p.full_name,
        p.department,
        p.avatar_url,
        COUNT(ta.task_id) as total_tasks,
        SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed_tasks
      FROM profiles p
      LEFT JOIN task_assignees ta ON p.id = ta.user_id
      LEFT JOIN tasks t ON ta.task_id = t.id
      WHERE p.email NOT LIKE '%temp.local' -- Exclude placeholder users if any remaining
      AND p.full_name != 'Optimed Admin'
      GROUP BY p.id, p.full_name, p.department, p.avatar_url
      ORDER BY total_tasks DESC
    `;

        const result = await connection.execute(sql);

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
                ratio: ratio
            };
        });

        return NextResponse.json(stats);

    } catch (error: any) {
        console.error('Stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}
