export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { moveFolder } from '@/lib/storage';
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
    const { folderIds, targetFolderId } = body;

    if (!folderIds || !Array.isArray(folderIds) || folderIds.length === 0) {
      return apiError('Folder IDs are required', 400);
    }

    // Validate all IDs are numbers
    const validIds = folderIds.filter((id: any) => !isNaN(parseInt(id))).map((id: any) => parseInt(id));
    
    if (validIds.length === 0) {
      return apiError('No valid folder IDs provided', 400);
    }

    const parsedTargetId = targetFolderId !== null && targetFolderId !== undefined 
      ? parseInt(targetFolderId) 
      : null;

    // Verify target folder exists if provided
    let targetFolder: Folder | null = null;
    if (parsedTargetId !== null) {
      const targetFolders = await query<Folder[]>(
        'SELECT * FROM folders WHERE id = ? AND user_id = ?',
        [parsedTargetId, user.id]
      );
      if (!targetFolders[0]) {
        return apiError('Target folder not found', 404);
      }
      targetFolder = targetFolders[0];
    }

    // Get all folders to move (verify ownership)
    const placeholders = validIds.map(() => '?').join(',');
    const folders = await query<Folder[]>(
      `SELECT * FROM folders WHERE id IN (${placeholders}) AND user_id = ?`,
      [...validIds, user.id]
    );

    if (folders.length === 0) {
      return apiError('No folders found', 404);
    }

    // Check if trying to move folders into themselves or their children
    if (targetFolder && targetFolder.path) {
      for (const folder of folders) {
        if (folder.id === parsedTargetId) {
          return apiError(`Cannot move folder "${folder.name}" into itself`, 400);
        }
        // Add null check for folder.path
        if (folder.path && targetFolder.path.startsWith(folder.path + '/')) {
          return apiError(`Cannot move folder "${folder.name}" into its own subfolder`, 400);
        }
      }
    }

    // Sort folders by path length (shallowest first for moving)
    // Add null check for path
    const sortedFolders = [...folders].sort((a, b) => (a.path?.length || 0) - (b.path?.length || 0));

    const results = {
      moved: [] as number[],
      failed: [] as { id: number; error: string }[],
    };

    // Move each folder
    for (const folder of sortedFolders) {
      // Skip if this folder is a child of another folder we're moving
      // Add null check for path
      const isChildOfMovingFolder = sortedFolders.some(f => 
        f.id !== folder.id && 
        f.path && 
        folder.path && 
        folder.path.startsWith(f.path + '/') &&
        !results.failed.some(fail => fail.id === f.id)
      );

      if (isChildOfMovingFolder) {
        // This folder will be moved automatically with its parent
        results.moved.push(folder.id);
        continue;
      }

      try {
        await moveFolder(folder.id, user.id, parsedTargetId);
        results.moved.push(folder.id);
      } catch (error: any) {
        results.failed.push({ id: folder.id, error: error.message });
      }
    }

    // Log activity
    await logActivity(
      user.id,
      'bulk_move_folders',
      { 
        moved: results.moved.length, 
        failed: results.failed.length,
        targetFolderId: parsedTargetId,
        folderNames: folders.filter(f => results.moved.includes(f.id)).map(f => f.name)
      },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(
      results,
      200,
      `ย้ายโฟลเดอร์สำเร็จ ${results.moved.length} โฟลเดอร์${results.failed.length > 0 ? `, ล้มเหลว ${results.failed.length} โฟลเดอร์` : ''}`
    );
  } catch (error: any) {
    console.error('Bulk move folders error:', error);
    return apiError(error.message || 'Bulk move failed', 500);
  }
}