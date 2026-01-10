import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { listFiles } from '@/lib/storage';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    const result = await listFiles(
      user.id,
      folderId ? parseInt(folderId) : null
    );

    return apiResponse(result);
  } catch (error: any) {
    console.error('List files error:', error);
    return apiError(error.message || 'Failed to list files', 500);
  }
}
