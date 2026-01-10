import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { moveFile } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { fileId, targetFolderId } = body;

    if (!fileId) {
      return apiError('File ID is required', 400);
    }

    const file = await moveFile(
      parseInt(fileId),
      user.id,
      targetFolderId ? parseInt(targetFolderId) : null
    );

    // Log activity
    await logActivity(
      user.id,
      'move',
      { filename: file.original_name, targetFolderId },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(file, 200, 'File moved successfully');
  } catch (error: any) {
    console.error('Move file error:', error);
    return apiError(error.message || 'Failed to move file', 500);
  }
}
