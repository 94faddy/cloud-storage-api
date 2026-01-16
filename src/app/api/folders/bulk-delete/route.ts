export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { deleteFolder } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { Folder } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { folderIds } = body;

    if (!folderIds || !Array.isArray(folderIds) || folderIds.length === 0) {
      return apiError('Folder IDs are required', 400);
    }

    // Validate all IDs are numbers
    const validIds = folderIds.filter((id: any) => !isNaN(parseInt(id))).map((id: any) => parseInt(id));
    
    if (validIds.length === 0) {
      return apiError('No valid folder IDs provided', 400);
    }

    // Get all folders to delete (verify ownership)
    const placeholders = validIds.map(() => '?').join(',');
    const folders = await query<Folder[]>(
      `SELECT * FROM folders WHERE id IN (${placeholders}) AND user_id = ?`,
      [...validIds, user.id]
    );

    if (folders.length === 0) {
      return apiError('No folders found', 404);
    }

    // Sort folders by path length (deepest first for deletion to avoid FK issues)
    // Add null check for path
    const sortedFolders = [...folders].sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0));

    const results = {
      deleted: [] as number[],
      failed: [] as { id: number; error: string }[],
    };

    // Track folders that will be deleted as children of other folders
    const childFolderIds = new Set<number>();
    
    // Find child folders that will be auto-deleted
    // Add null check for path
    for (const folder of folders) {
      for (const otherFolder of folders) {
        if (otherFolder.id !== folder.id && 
            folder.path && 
            otherFolder.path && 
            otherFolder.path.startsWith(folder.path + '/')) {
          childFolderIds.add(otherFolder.id);
        }
      }
    }

    // Delete each folder (skip child folders as they'll be deleted with parent)
    for (const folder of sortedFolders) {
      if (childFolderIds.has(folder.id)) {
        // This folder will be deleted automatically with its parent
        results.deleted.push(folder.id);
        continue;
      }

      try {
        await deleteFolder(folder.id, user.id);
        results.deleted.push(folder.id);
      } catch (error: any) {
        results.failed.push({ id: folder.id, error: error.message });
      }
    }

    // Log activity
    await logActivity(
      user.id,
      'bulk_delete_folders',
      { 
        deleted: results.deleted.length, 
        failed: results.failed.length,
        folderNames: folders.filter(f => results.deleted.includes(f.id)).map(f => f.name)
      },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(
      results,
      200,
      `ลบโฟลเดอร์สำเร็จ ${results.deleted.length} โฟลเดอร์${results.failed.length > 0 ? `, ล้มเหลว ${results.failed.length} โฟลเดอร์` : ''}`
    );
  } catch (error: any) {
    console.error('Bulk delete folders error:', error);
    return apiError(error.message || 'Bulk delete failed', 500);
  }
}