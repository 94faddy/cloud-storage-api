export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { renameFile } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const fileId = parseInt(params.id);
    if (isNaN(fileId)) {
      return apiError('Invalid file ID', 400);
    }

    const body = await request.json();
    const { newName } = body;

    if (!newName || typeof newName !== 'string') {
      return apiError('New file name is required', 400);
    }

    // Rename the file
    const result = await renameFile(fileId, user.id, newName);

    // Log activity
    await logActivity(
      user.id,
      'rename_file',
      { 
        fileId,
        oldName: result.oldName,
        newName: result.newName
      },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(result.file, 200, 'File renamed successfully');
  } catch (error: any) {
    console.error('Rename file error:', error);
    return apiError(error.message || 'Failed to rename file', 500);
  }
}