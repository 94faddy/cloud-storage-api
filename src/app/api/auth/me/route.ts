import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getStorageStats } from '@/lib/storage';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const stats = await getStorageStats(user.id);

    return apiResponse({
      user,
      stats,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    return apiError(error.message || 'Failed to get user', 500);
  }
}
