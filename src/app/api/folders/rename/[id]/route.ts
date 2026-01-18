export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { renameFolder } from '@/lib/storage';
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

    const folderId = parseInt(params.id);
    if (isNaN(folderId)) {
      return apiError('Invalid folder ID', 400);
    }

    const body = await request.json();
    const { newName } = body;

    if (!newName || typeof newName !== 'string') {
      return apiError('New folder name is required', 400);
    }

    // Rename the folder
    const result = await renameFolder(folderId, user.id, newName);

    // Log activity
    await logActivity(
      user.id,
      'rename_folder',
      { 
        folderId,
        oldName: result.oldName,
        newName: result.newName
      },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(result.folder, 200, 'Folder renamed successfully');
  } catch (error: any) {
    console.error('Rename folder error:', error);
    return apiError(error.message || 'Failed to rename folder', 500);
  }
}