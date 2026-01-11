export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils';
import { Folder } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');

    const folders = await query<Folder[]>(
      'SELECT * FROM folders WHERE user_id = ? AND parent_id <=> ? ORDER BY name',
      [user.id, parentId ? parseInt(parentId) : null]
    );

    return apiResponse(folders);
  } catch (error: any) {
    console.error('List folders error:', error);
    return apiError(error.message || 'Failed to list folders', 500);
  }
}
