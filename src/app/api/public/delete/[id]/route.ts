import { NextRequest } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { deleteFile } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { File } from '@/types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    if (!auth.permissions.delete) {
      return apiError('Delete permission denied', 403);
    }

    const fileId = parseInt(params.id);
    if (isNaN(fileId)) {
      return apiError('Invalid file ID', 400);
    }

    // Get file info before deletion
    const files = await query<File[]>(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [fileId, auth.user.id]
    );

    if (!files[0]) {
      return apiError('File not found', 404);
    }

    const file = files[0];

    await deleteFile(fileId, auth.user.id);

    // Log activity
    await logActivity(
      auth.user.id,
      'delete',
      { filename: file.original_name, via: 'api' },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(null, 200, 'File deleted successfully');
  } catch (error: any) {
    console.error('Public delete error:', error);
    return apiError(error.message || 'Delete failed', 500);
  }
}
