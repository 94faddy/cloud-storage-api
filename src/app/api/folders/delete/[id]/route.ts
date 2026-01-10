import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { deleteFolder } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { Folder } from '@/types';

export async function DELETE(
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

    // Get folder info before deletion
    const folders = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [folderId, user.id]
    );

    if (!folders[0]) {
      return apiError('Folder not found', 404);
    }

    const folder = folders[0];

    await deleteFolder(folderId, user.id);

    // Log activity
    await logActivity(
      user.id,
      'delete_folder',
      { name: folder.name },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(null, 200, 'Folder deleted successfully');
  } catch (error: any) {
    console.error('Delete folder error:', error);
    return apiError(error.message || 'Failed to delete folder', 500);
  }
}
