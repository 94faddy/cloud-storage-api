export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { moveFile } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { File } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    // Check if API key has permission (requires upload or delete permission for moving)
    if (!auth.permissions.delete && !auth.permissions.upload) {
      return apiError('Move permission denied. Requires upload or delete permission.', 403);
    }

    const body = await request.json();
    const { fileId, targetFolderId } = body;

    if (!fileId) {
      return apiError('File ID is required', 400);
    }

    // Verify file exists and belongs to user
    const files = await query<File[]>(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [parseInt(fileId), auth.user.id]
    );

    if (!files[0]) {
      return apiError('File not found', 404);
    }

    const file = await moveFile(
      parseInt(fileId),
      auth.user.id,
      targetFolderId !== undefined && targetFolderId !== null ? parseInt(targetFolderId) : null
    );

    // Log activity
    await logActivity(
      auth.user.id,
      'move',
      { filename: file.original_name, targetFolderId, via: 'api' },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(file, 200, 'File moved successfully');
  } catch (error: any) {
    console.error('Public move file error:', error);
    return apiError(error.message || 'Failed to move file', 500);
  }
}