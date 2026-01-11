export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { listFiles } from '@/lib/storage';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    if (!auth.permissions.list) {
      return apiError('List permission denied', 403);
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    const result = await listFiles(
      auth.user.id,
      folderId ? parseInt(folderId) : null
    );

    return apiResponse(result);
  } catch (error: any) {
    console.error('Public list files error:', error);
    return apiError(error.message || 'Failed to list files', 500);
  }
}
