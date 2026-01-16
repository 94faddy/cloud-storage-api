export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { moveFile } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { File, Folder } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { fileIds, targetFolderId } = body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return apiError('File IDs are required', 400);
    }

    // Validate all IDs are numbers
    const validIds = fileIds.filter((id: any) => !isNaN(parseInt(id))).map((id: any) => parseInt(id));
    
    if (validIds.length === 0) {
      return apiError('No valid file IDs provided', 400);
    }

    const parsedTargetId = targetFolderId !== null && targetFolderId !== undefined 
      ? parseInt(targetFolderId) 
      : null;

    // Verify target folder exists if provided
    if (parsedTargetId !== null) {
      const targetFolders = await query<Folder[]>(
        'SELECT * FROM folders WHERE id = ? AND user_id = ?',
        [parsedTargetId, user.id]
      );
      if (!targetFolders[0]) {
        return apiError('Target folder not found', 404);
      }
    }

    // Get all files to move (verify ownership)
    const placeholders = validIds.map(() => '?').join(',');
    const files = await query<File[]>(
      `SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ?`,
      [...validIds, user.id]
    );

    if (files.length === 0) {
      return apiError('No files found', 404);
    }

    const results = {
      moved: [] as number[],
      failed: [] as { id: number; error: string }[],
    };

    // Move each file
    for (const file of files) {
      try {
        await moveFile(file.id, user.id, parsedTargetId);
        results.moved.push(file.id);
      } catch (error: any) {
        results.failed.push({ id: file.id, error: error.message });
      }
    }

    // Log activity
    await logActivity(
      user.id,
      'bulk_move_files',
      { 
        moved: results.moved.length, 
        failed: results.failed.length,
        targetFolderId: parsedTargetId,
        fileNames: files.filter(f => results.moved.includes(f.id)).map(f => f.original_name)
      },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(
      results,
      200,
      `ย้ายไฟล์สำเร็จ ${results.moved.length} ไฟล์${results.failed.length > 0 ? `, ล้มเหลว ${results.failed.length} ไฟล์` : ''}`
    );
  } catch (error: any) {
    console.error('Bulk move files error:', error);
    return apiError(error.message || 'Bulk move failed', 500);
  }
}