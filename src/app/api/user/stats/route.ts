export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getStorageStats } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const stats = await getStorageStats(user.id);

    // Get recent activity
    const recentActivity = await query<any[]>(
      `SELECT action, details, created_at 
       FROM activity_logs 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [user.id]
    );

    // Get file type distribution
    const fileTypes = await query<any[]>(
      `SELECT 
         CASE 
           WHEN mime_type LIKE 'image/%' THEN 'Images'
           WHEN mime_type LIKE 'video/%' THEN 'Videos'
           WHEN mime_type LIKE 'audio/%' THEN 'Audio'
           WHEN mime_type LIKE 'application/pdf' THEN 'PDF'
           WHEN mime_type LIKE 'application/%' OR mime_type LIKE 'text/%' THEN 'Documents'
           ELSE 'Other'
         END as type,
         COUNT(*) as count,
         SUM(size) as total_size
       FROM files 
       WHERE user_id = ?
       GROUP BY type`,
      [user.id]
    );

    return apiResponse({
      storage: stats,
      recentActivity,
      fileTypes,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return apiError(error.message || 'Failed to get stats', 500);
  }
}