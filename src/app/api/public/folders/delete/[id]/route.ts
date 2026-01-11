export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { deleteFolder } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { Folder } from '@/types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    if (!auth.permissions.deleteFolder) {
      return apiError('Delete folder permission denied', 403);
    }

    const folderId = parseInt(params.id);
    if (isNaN(folderId)) {
      return apiError('Invalid folder ID', 400);
    }

    const folders = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [folderId, auth.user.id]
    );

    if (!folders[0]) {
      return apiError('Folder not found', 404);
    }

    const folder = folders[0];

    await deleteFolder(folderId, auth.user.id);

    await logActivity(
      auth.user.id,
      'delete_folder',
      { name: folder.name, via: 'api' },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(null, 200, 'Folder deleted successfully');
  } catch (error: any) {
    console.error('Public delete folder error:', error);
    return apiError(error.message || 'Failed to delete folder', 500);
  }
}