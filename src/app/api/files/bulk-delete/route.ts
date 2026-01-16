export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { deleteFile } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { File } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { fileIds } = body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return apiError('File IDs are required', 400);
    }

    // Validate all IDs are numbers
    const validIds = fileIds.filter((id: any) => !isNaN(parseInt(id))).map((id: any) => parseInt(id));
    
    if (validIds.length === 0) {
      return apiError('No valid file IDs provided', 400);
    }

    // Get all files to delete (verify ownership)
    const placeholders = validIds.map(() => '?').join(',');
    const files = await query<File[]>(
      `SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ?`,
      [...validIds, user.id]
    );

    if (files.length === 0) {
      return apiError('No files found', 404);
    }

    const results = {
      deleted: [] as number[],
      failed: [] as { id: number; error: string }[],
    };

    // Delete each file
    for (const file of files) {
      try {
        await deleteFile(file.id, user.id);
        results.deleted.push(file.id);
      } catch (error: any) {
        results.failed.push({ id: file.id, error: error.message });
      }
    }

    // Log activity
    await logActivity(
      user.id,
      'bulk_delete_files',
      { 
        deleted: results.deleted.length, 
        failed: results.failed.length,
        fileNames: files.filter(f => results.deleted.includes(f.id)).map(f => f.original_name)
      },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(
      results,
      200,
      `ลบไฟล์สำเร็จ ${results.deleted.length} ไฟล์${results.failed.length > 0 ? `, ล้มเหลว ${results.failed.length} ไฟล์` : ''}`
    );
  } catch (error: any) {
    console.error('Bulk delete files error:', error);
    return apiError(error.message || 'Bulk delete failed', 500);
  }
}