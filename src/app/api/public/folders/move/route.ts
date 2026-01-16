export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { moveFolder } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { Folder } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    // Check permissions - require createFolder or deleteFolder permission for moving folders
    if (!auth.permissions.createFolder && !auth.permissions.deleteFolder) {
      return apiError('Move folder permission denied. Requires createFolder or deleteFolder permission.', 403);
    }

    const body = await request.json();
    const { folderId, targetFolderId } = body;

    if (!folderId) {
      return apiError('Folder ID is required', 400);
    }

    // Verify folder exists and belongs to user
    const folders = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [parseInt(folderId), auth.user.id]
    );

    if (!folders[0]) {
      return apiError('Folder not found', 404);
    }

    const folder = await moveFolder(
      parseInt(folderId),
      auth.user.id,
      targetFolderId !== undefined && targetFolderId !== null ? parseInt(targetFolderId) : null
    );

    // Log activity
    await logActivity(
      auth.user.id,
      'move_folder',
      { folderName: folder.name, targetFolderId, via: 'api' },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(folder, 200, 'Folder moved successfully');
  } catch (error: any) {
    console.error('Public move folder error:', error);
    return apiError(error.message || 'Failed to move folder', 500);
  }
}