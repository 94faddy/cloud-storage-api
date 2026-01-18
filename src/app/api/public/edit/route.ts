export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { renameFile, renameFolder } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { File, Folder } from '@/types';

/**
 * Public API for editing files/folders
 * 
 * Currently supports:
 * - rename: Change the name of a file or folder
 * 
 * Future support planned for:
 * - Other edit operations as needed
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    const body = await request.json();
    const { action, type, id, newName } = body;

    // Validate required fields
    if (!action) {
      return apiError('Action is required (e.g., "rename")', 400);
    }

    if (!type || !['file', 'folder'].includes(type)) {
      return apiError('Type is required and must be "file" or "folder"', 400);
    }

    if (!id) {
      return apiError('ID is required', 400);
    }

    const itemId = parseInt(id);
    if (isNaN(itemId)) {
      return apiError('Invalid ID', 400);
    }

    // Handle different actions
    switch (action) {
      case 'rename':
        return handleRename(request, auth, type, itemId, newName);
      
      // Future actions can be added here
      // case 'duplicate':
      // case 'archive':
      // etc.
      
      default:
        return apiError(`Unknown action: ${action}. Supported actions: rename`, 400);
    }
  } catch (error: any) {
    console.error('Public edit error:', error);
    return apiError(error.message || 'Edit operation failed', 500);
  }
}

/**
 * Handle rename action
 */
async function handleRename(
  request: NextRequest,
  auth: { user: any; apiKey: any; permissions: any },
  type: 'file' | 'folder',
  id: number,
  newName: string
) {
  // Check permissions
  if (type === 'file') {
    // Require upload or delete permission for editing files
    if (!auth.permissions.upload && !auth.permissions.delete) {
      return apiError('Edit file permission denied. Requires upload or delete permission.', 403);
    }
  } else {
    // Require createFolder or deleteFolder permission for editing folders
    if (!auth.permissions.createFolder && !auth.permissions.deleteFolder) {
      return apiError('Edit folder permission denied. Requires createFolder or deleteFolder permission.', 403);
    }
  }

  // Validate new name
  if (!newName || typeof newName !== 'string') {
    return apiError('New name is required', 400);
  }

  const trimmedName = newName.trim();
  if (!trimmedName) {
    return apiError('New name cannot be empty', 400);
  }

  try {
    if (type === 'file') {
      // Get original file info
      const files = await query<File[]>(
        'SELECT * FROM files WHERE id = ? AND user_id = ?',
        [id, auth.user.id]
      );

      if (!files[0]) {
        return apiError('File not found', 404);
      }

      const result = await renameFile(id, auth.user.id, trimmedName);

      // Log activity
      await logActivity(
        auth.user.id,
        'rename_file',
        { 
          fileId: id,
          oldName: result.oldName,
          newName: result.newName,
          via: 'api'
        },
        getClientIp(request),
        getUserAgent(request)
      );

      return apiResponse(
        {
          id: result.file.id,
          name: result.file.name,
          original_name: result.file.original_name,
          oldName: result.oldName,
          newName: result.newName,
          action: 'rename',
          type: 'file'
        },
        200,
        'File renamed successfully'
      );

    } else {
      // Get original folder info
      const folders = await query<Folder[]>(
        'SELECT * FROM folders WHERE id = ? AND user_id = ?',
        [id, auth.user.id]
      );

      if (!folders[0]) {
        return apiError('Folder not found', 404);
      }

      const result = await renameFolder(id, auth.user.id, trimmedName);

      // Log activity
      await logActivity(
        auth.user.id,
        'rename_folder',
        { 
          folderId: id,
          oldName: result.oldName,
          newName: result.newName,
          via: 'api'
        },
        getClientIp(request),
        getUserAgent(request)
      );

      return apiResponse(
        {
          id: result.folder.id,
          name: result.folder.name,
          path: result.folder.path,
          oldName: result.oldName,
          newName: result.newName,
          action: 'rename',
          type: 'folder'
        },
        200,
        'Folder renamed successfully'
      );
    }

  } catch (error: any) {
    return apiError(error.message || `Failed to rename ${type}`, 500);
  }
}