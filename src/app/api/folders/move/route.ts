export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { moveFolder } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { folderId, targetFolderId } = body;

    if (!folderId) {
      return apiError('Folder ID is required', 400);
    }

    const folder = await moveFolder(
      parseInt(folderId),
      user.id,
      targetFolderId !== undefined && targetFolderId !== null ? parseInt(targetFolderId) : null
    );

    // Log activity
    await logActivity(
      user.id,
      'move_folder',
      { folderName: folder.name, targetFolderId },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(folder, 200, 'Folder moved successfully');
  } catch (error: any) {
    console.error('Move folder error:', error);
    return apiError(error.message || 'Failed to move folder', 500);
  }
}