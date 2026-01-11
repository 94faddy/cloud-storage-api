export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { deleteFile } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { File } from '@/types';

export async function DELETE(
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

    // Get file info before deletion
    const files = await query<File[]>(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [fileId, user.id]
    );

    if (!files[0]) {
      return apiError('File not found', 404);
    }

    const file = files[0];

    await deleteFile(fileId, user.id);

    // Log activity
    await logActivity(
      user.id,
      'delete',
      { filename: file.original_name },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(null, 200, 'File deleted successfully');
  } catch (error: any) {
    console.error('Delete error:', error);
    return apiError(error.message || 'Delete failed', 500);
  }
}
