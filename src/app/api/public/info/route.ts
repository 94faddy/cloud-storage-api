export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { getStorageStats } from '@/lib/storage';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    // ใช้ list permission สำหรับดูข้อมูล
    if (!auth.permissions.list) {
      return apiError('List permission required to view storage info', 403);
    }

    const stats = await getStorageStats(auth.user.id);

    // Format response
    const response = {
      storage: {
        used: stats.used,
        limit: stats.limit,
        available: stats.limit - stats.used,
        percentage: stats.percentage,
        // Human readable format
        used_formatted: formatBytes(stats.used),
        limit_formatted: formatBytes(stats.limit),
        available_formatted: formatBytes(stats.limit - stats.used),
      },
      counts: {
        files: stats.files_count,
        folders: stats.folders_count,
      },
      user: {
        username: auth.user.username,
        email: auth.user.email,
      }
    };

    return apiResponse(response, 200, 'Storage info retrieved successfully');
  } catch (error: any) {
    console.error('Public info error:', error);
    return apiError(error.message || 'Failed to get storage info', 500);
  }
}

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}