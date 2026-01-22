import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import { query } from './db';
import { File, Folder, StorageStats, User } from '@/types';

const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';
// NEXT_PUBLIC_MAX_FILE_SIZE_MB = 0 means unlimited
const MAX_FILE_SIZE_MB = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '0');
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB > 0 ? (MAX_FILE_SIZE_MB * 1024 * 1024) : 0;

export function getStoragePath(): string {
  return path.resolve(process.cwd(), STORAGE_PATH);
}

export function getUserStoragePath(userId: number): string {
  return path.join(getStoragePath(), `user_${userId}`);
}

export async function ensureUserDirectory(userId: number): Promise<string> {
  const userPath = getUserStoragePath(userId);
  await fs.mkdir(userPath, { recursive: true });
  return userPath;
}

export async function getStorageStats(userId: number): Promise<StorageStats> {
  const users = await query<User[]>(
    'SELECT storage_used, storage_limit FROM users WHERE id = ?',
    [userId]
  );

  const user = users[0];
  if (!user) throw new Error('User not found');

  const filesCount = await query<any[]>(
    'SELECT COUNT(*) as count FROM files WHERE user_id = ?',
    [userId]
  );

  const foldersCount = await query<any[]>(
    'SELECT COUNT(*) as count FROM folders WHERE user_id = ?',
    [userId]
  );

  return {
    used: user.storage_used,
    limit: user.storage_limit,
    percentage: Math.round((user.storage_used / user.storage_limit) * 100),
    files_count: filesCount[0]?.count || 0,
    folders_count: foldersCount[0]?.count || 0,
  };
}

export async function checkStorageLimit(userId: number, fileSize: number): Promise<boolean> {
  const stats = await getStorageStats(userId);
  return (stats.used + fileSize) <= stats.limit;
}

export async function updateStorageUsed(userId: number, sizeDelta: number): Promise<void> {
  await query(
    'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
    [sizeDelta, userId]
  );
}

export async function saveFile(
  userId: number,
  buffer: Buffer,
  originalName: string,
  folderId: number | null = null,
  relativePath: string = ''
): Promise<File> {
  // Check file size (skip if unlimited - MAX_FILE_SIZE = 0)
  if (MAX_FILE_SIZE > 0 && buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed (${MAX_FILE_SIZE_MB}MB)`);
  }

  // Check storage limit
  const hasSpace = await checkStorageLimit(userId, buffer.length);
  if (!hasSpace) {
    throw new Error('Storage limit exceeded');
  }

  // Generate unique filename
  const ext = path.extname(originalName);
  const filename = `${uuidv4()}${ext}`;
  const mimeType = mime.lookup(originalName) || 'application/octet-stream';

  // Ensure user directory exists
  const userPath = await ensureUserDirectory(userId);
  
  // Determine target folder - use folderId directly if provided
  let targetDir = userPath;
  let actualFolderId = folderId;
  
  // If folderId is provided, verify it exists and get its path
  if (folderId !== null) {
    const folderResult = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [folderId, userId]
    );
    
    if (folderResult[0]) {
      targetDir = path.join(userPath, folderResult[0].path);
      await fs.mkdir(targetDir, { recursive: true });
    }
  }
  
  // Handle relative path for folder uploads (nested folders within target)
  if (relativePath) {
    const folderPath = path.dirname(relativePath);
    
    if (folderPath && folderPath !== '.') {
      // Create physical directory under target
      targetDir = path.join(targetDir, folderPath);
      await fs.mkdir(targetDir, { recursive: true });
      
      // Create folder records in database (nested folders)
      const folderParts = folderPath.split(/[\/\\]/);
      let parentId: number | null = folderId;
      let currentPath = '';
      
      // Get base path from parent folder
      if (folderId !== null) {
        const parentFolder = await query<Folder[]>(
          'SELECT path FROM folders WHERE id = ?',
          [folderId]
        );
        if (parentFolder[0]) {
          currentPath = parentFolder[0].path;
        }
      }
      
      for (const folderName of folderParts) {
        if (!folderName) continue;
        
        currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        
        // Check if folder already exists
        const existingFolders = await query<Folder[]>(
          'SELECT * FROM folders WHERE user_id = ? AND path = ?',
          [userId, currentPath]
        );
        
        if (existingFolders[0]) {
          parentId = existingFolders[0].id;
        } else {
          // Create new folder
          const folderResult = await query<any>(
            'INSERT INTO folders (user_id, parent_id, name, path) VALUES (?, ?, ?, ?)',
            [userId, parentId, folderName, currentPath]
          );
          parentId = folderResult.insertId;
        }
      }
      
      actualFolderId = parentId;
    }
  }

  const filePath = path.join(targetDir, filename);
  const dbPath = path.relative(getStoragePath(), filePath);

  // Save file
  await fs.writeFile(filePath, buffer);

  // Save to database
  const result = await query<any>(
    `INSERT INTO files (user_id, folder_id, name, original_name, mime_type, size, path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, actualFolderId, filename, originalName, mimeType, buffer.length, dbPath]
  );

  // Update storage used
  await updateStorageUsed(userId, buffer.length);

  const files = await query<File[]>('SELECT * FROM files WHERE id = ?', [result.insertId]);
  return files[0];
}

export async function deleteFile(fileId: number, userId: number): Promise<void> {
  const files = await query<File[]>(
    'SELECT * FROM files WHERE id = ? AND user_id = ?',
    [fileId, userId]
  );

  if (!files[0]) {
    throw new Error('File not found');
  }

  const file = files[0];
  const filePath = path.join(getStoragePath(), file.path);

  // Delete physical file
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting physical file:', error);
  }

  // Delete from database
  await query('DELETE FROM files WHERE id = ?', [fileId]);

  // Update storage used
  await updateStorageUsed(userId, -file.size);
}

export async function getFile(fileId: number, userId: number): Promise<{ file: File; buffer: Buffer }> {
  const files = await query<File[]>(
    'SELECT * FROM files WHERE id = ? AND user_id = ?',
    [fileId, userId]
  );

  if (!files[0]) {
    throw new Error('File not found');
  }

  const file = files[0];
  const filePath = path.join(getStoragePath(), file.path);
  const buffer = await fs.readFile(filePath);

  return { file, buffer };
}

export async function getPublicFile(publicUrl: string): Promise<{ file: File; buffer: Buffer } | null> {
  console.log('getPublicFile called with:', publicUrl);
  
  const files = await query<File[]>(
    'SELECT * FROM files WHERE public_url = ? AND is_public = 1',
    [publicUrl]
  );

  console.log('getPublicFile query result:', files.length > 0 ? files[0] : 'No file found');

  if (!files[0]) return null;

  const file = files[0];
  const filePath = path.join(getStoragePath(), file.path);
  console.log('getPublicFile filePath:', filePath);
  
  const buffer = await fs.readFile(filePath);

  return { file, buffer };
}

export async function setFilePublic(fileId: number, userId: number, isPublic: boolean, cdnPrefix?: string): Promise<File> {
  const files = await query<File[]>(
    'SELECT * FROM files WHERE id = ? AND user_id = ?',
    [fileId, userId]
  );

  if (!files[0]) {
    throw new Error('File not found');
  }

  const publicUrl = isPublic ? uuidv4() : null;
  // Sanitize cdnPrefix - ลบอักขระพิเศษ, เหลือแค่ a-z, 0-9, -, _
  const sanitizedPrefix = cdnPrefix 
    ? cdnPrefix.toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 50)
    : null;

  await query(
    'UPDATE files SET is_public = ?, public_url = ?, cdn_prefix = ? WHERE id = ?',
    [isPublic, publicUrl, isPublic ? sanitizedPrefix : null, fileId]
  );

  const updatedFiles = await query<File[]>('SELECT * FROM files WHERE id = ?', [fileId]);
  return updatedFiles[0];
}

export async function setFolderPublic(folderId: number, userId: number, isPublic: boolean): Promise<Folder> {
  const folders = await query<Folder[]>(
    'SELECT * FROM folders WHERE id = ? AND user_id = ?',
    [folderId, userId]
  );

  if (!folders[0]) {
    throw new Error('Folder not found');
  }

  const publicUrl = isPublic ? uuidv4() : null;

  await query(
    'UPDATE folders SET is_public = ?, public_url = ? WHERE id = ?',
    [isPublic, publicUrl, folderId]
  );

  const updatedFolders = await query<Folder[]>('SELECT * FROM folders WHERE id = ?', [folderId]);
  return updatedFolders[0];
}

export async function getPublicFolder(publicUrl: string): Promise<Folder | null> {
  const folders = await query<Folder[]>(
    'SELECT * FROM folders WHERE public_url = ? AND is_public = 1',
    [publicUrl]
  );

  return folders[0] || null;
}

export async function getSharedContent(shareId: string): Promise<{
  type: 'file' | 'folder';
  item: File | Folder;
  ownerName: string;
} | null> {
  // Check if it's a file
  const files = await query<any[]>(
    `SELECT f.*, u.username as owner_name 
     FROM files f 
     JOIN users u ON f.user_id = u.id 
     WHERE f.public_url = ? AND f.is_public = 1`,
    [shareId]
  );

  if (files[0]) {
    return {
      type: 'file',
      item: files[0],
      ownerName: files[0].owner_name
    };
  }

  // Check if it's a folder
  const folders = await query<any[]>(
    `SELECT f.*, u.username as owner_name 
     FROM folders f 
     JOIN users u ON f.user_id = u.id 
     WHERE f.public_url = ? AND f.is_public = 1`,
    [shareId]
  );

  if (folders[0]) {
    return {
      type: 'folder',
      item: folders[0],
      ownerName: folders[0].owner_name
    };
  }

  return null;
}

export async function getSharedFolderContents(
  folderId: number,
  subPath: string = ''
): Promise<{ files: File[]; folders: Folder[] }> {
  let targetFolderId = folderId;

  // If subPath is provided, find the actual folder
  if (subPath) {
    const folder = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ?',
      [folderId]
    );

    if (!folder[0]) {
      throw new Error('Folder not found');
    }

    const fullPath = `${folder[0].path}/${subPath}`;
    const subFolder = await query<Folder[]>(
      'SELECT * FROM folders WHERE user_id = ? AND path = ?',
      [folder[0].user_id, fullPath]
    );

    if (subFolder[0]) {
      targetFolderId = subFolder[0].id;
    } else {
      return { files: [], folders: [] };
    }
  }

  const files = await query<File[]>(
    'SELECT * FROM files WHERE folder_id = ? ORDER BY original_name',
    [targetFolderId]
  );

  const folders = await query<Folder[]>(
    'SELECT * FROM folders WHERE parent_id = ? ORDER BY name',
    [targetFolderId]
  );

  return { files, folders };
}

export async function getFileById(fileId: number): Promise<{ file: File; buffer: Buffer } | null> {
  const files = await query<File[]>(
    'SELECT * FROM files WHERE id = ?',
    [fileId]
  );

  if (!files[0]) return null;

  const file = files[0];
  const filePath = path.join(getStoragePath(), file.path);
  
  try {
    const buffer = await fs.readFile(filePath);
    return { file, buffer };
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}

export async function createFolder(
  userId: number,
  name: string,
  parentId: number | null = null
): Promise<Folder> {
  // Get parent path
  let parentPath = '';
  if (parentId) {
    const parents = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [parentId, userId]
    );
    if (!parents[0]) {
      throw new Error('Parent folder not found');
    }
    parentPath = parents[0].path;
  }

  const folderPath = parentPath ? `${parentPath}/${name}` : name;

  // Check if folder already exists
  const existing = await query<Folder[]>(
    'SELECT * FROM folders WHERE user_id = ? AND path = ?',
    [userId, folderPath]
  );

  if (existing[0]) {
    throw new Error('Folder already exists');
  }

  const result = await query<any>(
    'INSERT INTO folders (user_id, parent_id, name, path) VALUES (?, ?, ?, ?)',
    [userId, parentId, name, folderPath]
  );

  // Create physical directory
  const physicalPath = path.join(getUserStoragePath(userId), folderPath);
  await fs.mkdir(physicalPath, { recursive: true });

  const folders = await query<Folder[]>('SELECT * FROM folders WHERE id = ?', [result.insertId]);
  return folders[0];
}

// ========================================
// 🚀 FIXED: Delete Folder Function
// ========================================
export async function deleteFolder(folderId: number, userId: number): Promise<void> {
  const folders = await query<Folder[]>(
    'SELECT * FROM folders WHERE id = ? AND user_id = ?',
    [folderId, userId]
  );

  if (!folders[0]) {
    throw new Error('Folder not found');
  }

  const folder = folders[0];

  // Ensure folder has a valid path
  if (!folder.path) {
    // If path is null, just delete the folder and its direct files
    await query('DELETE FROM files WHERE user_id = ? AND folder_id = ?', [userId, folderId]);
    await query('DELETE FROM folders WHERE id = ?', [folderId]);
    return;
  }

  // Get all files in this folder and subfolders
  const files = await query<File[]>(
    `SELECT * FROM files WHERE user_id = ? AND (folder_id = ? OR folder_id IN (
      SELECT id FROM folders WHERE user_id = ? AND path LIKE ?
    ))`,
    [userId, folderId, userId, `${folder.path}/%`]
  );

  // Calculate total size to remove
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  // Delete physical directory
  const physicalPath = path.join(getUserStoragePath(userId), folder.path);
  try {
    await fs.rm(physicalPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Error deleting physical directory:', error);
  }

  // Delete files in this folder from database
  await query('DELETE FROM files WHERE user_id = ? AND folder_id = ?', [userId, folderId]);
  
  // Delete files in subfolders
  await query(
    `DELETE FROM files WHERE user_id = ? AND folder_id IN (
      SELECT id FROM folders WHERE user_id = ? AND path LIKE ?
    )`,
    [userId, userId, `${folder.path}/%`]
  );

  // Delete subfolders first (due to foreign key constraints)
  await query(
    'DELETE FROM folders WHERE user_id = ? AND path LIKE ?',
    [userId, `${folder.path}/%`]
  );
  
  // Delete the main folder
  await query('DELETE FROM folders WHERE id = ?', [folderId]);

  // Update storage used
  await updateStorageUsed(userId, -totalSize);
}

export async function listFiles(
  userId: number,
  folderId: number | null = null
): Promise<{ files: File[]; folders: Folder[] }> {
  const files = await query<File[]>(
    'SELECT * FROM files WHERE user_id = ? AND folder_id <=> ? ORDER BY original_name',
    [userId, folderId]
  );

  const folders = await query<Folder[]>(
    'SELECT * FROM folders WHERE user_id = ? AND parent_id <=> ? ORDER BY name',
    [userId, folderId]
  );

  return { files, folders };
}

// ========================================
// 🚀 FIXED: Move File Function
// ย้ายไฟล์จริงบน disk และอัพเดท path
// ========================================
export async function moveFile(
  fileId: number,
  userId: number,
  targetFolderId: number | null
): Promise<File> {
  const files = await query<File[]>(
    'SELECT * FROM files WHERE id = ? AND user_id = ?',
    [fileId, userId]
  );

  if (!files[0]) {
    throw new Error('File not found');
  }

  const file = files[0];

  // Get target folder path
  let targetPath = `user_${userId}`;
  let targetPhysicalDir = getUserStoragePath(userId);

  if (targetFolderId !== null) {
    const targetFolders = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [targetFolderId, userId]
    );
    if (!targetFolders[0]) {
      throw new Error('Target folder not found');
    }
    const targetFolder = targetFolders[0];
    if (targetFolder.path) {
      targetPath = `user_${userId}/${targetFolder.path}`;
      targetPhysicalDir = path.join(getUserStoragePath(userId), targetFolder.path);
    }
  }

  // Calculate new path
  const fileName = file.name; // UUID filename like "fb3fd6f9-03d2-440f-a526-c1009a0626ad.jpg"
  const newDbPath = `${targetPath}/${fileName}`;
  const oldPhysicalPath = path.join(getStoragePath(), file.path);
  const newPhysicalPath = path.join(targetPhysicalDir, fileName);

  // Skip if file is already in the target location
  if (file.path === newDbPath) {
    return file;
  }

  // Ensure target directory exists
  await fs.mkdir(targetPhysicalDir, { recursive: true });

  // Move physical file
  try {
    await fs.rename(oldPhysicalPath, newPhysicalPath);
  } catch (error: any) {
    // If rename fails (cross-device), try copy + delete
    if (error.code === 'EXDEV') {
      await fs.copyFile(oldPhysicalPath, newPhysicalPath);
      await fs.unlink(oldPhysicalPath);
    } else {
      console.error('Error moving physical file:', error);
      throw new Error('Failed to move file on disk');
    }
  }

  // Update database
  await query(
    'UPDATE files SET folder_id = ?, path = ? WHERE id = ?',
    [targetFolderId, newDbPath, fileId]
  );

  const updatedFiles = await query<File[]>('SELECT * FROM files WHERE id = ?', [fileId]);
  return updatedFiles[0];
}

// ========================================
// 🚀 FIXED: Move Folder Function
// ========================================
export async function moveFolder(
  folderId: number,
  userId: number,
  targetFolderId: number | null
): Promise<Folder> {
  // Get source folder
  const folders = await query<Folder[]>(
    'SELECT * FROM folders WHERE id = ? AND user_id = ?',
    [folderId, userId]
  );

  if (!folders[0]) {
    throw new Error('Folder not found');
  }

  const sourceFolder = folders[0];

  // Ensure source folder has a path
  if (!sourceFolder.path) {
    throw new Error('Source folder has invalid path');
  }

  // Cannot move folder into itself or its children
  if (targetFolderId !== null) {
    if (targetFolderId === folderId) {
      throw new Error('Cannot move folder into itself');
    }

    // Check if target is a child of source
    const targetFolders = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [targetFolderId, userId]
    );

    if (!targetFolders[0]) {
      throw new Error('Target folder not found');
    }

    const targetFolder = targetFolders[0];
    
    // Check if target path starts with source path (meaning target is inside source)
    if (targetFolder.path && targetFolder.path.startsWith(sourceFolder.path + '/')) {
      throw new Error('Cannot move folder into its own subfolder');
    }
  }

  // Calculate new path
  let newPath = sourceFolder.name;
  if (targetFolderId !== null) {
    const targetFolders = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ?',
      [targetFolderId]
    );
    if (targetFolders[0] && targetFolders[0].path) {
      newPath = `${targetFolders[0].path}/${sourceFolder.name}`;
    }
  }

  // Check if folder with same name already exists in target
  const existing = await query<Folder[]>(
    'SELECT * FROM folders WHERE user_id = ? AND path = ? AND id != ?',
    [userId, newPath, folderId]
  );

  if (existing[0]) {
    throw new Error('A folder with the same name already exists in the target location');
  }

  const oldPath = sourceFolder.path;

  // Get all child folders before updating
  const childFolders = await query<Folder[]>(
    'SELECT * FROM folders WHERE user_id = ? AND path LIKE ?',
    [userId, `${oldPath}/%`]
  );

  // Update the folder's parent and path
  await query(
    'UPDATE folders SET parent_id = ?, path = ? WHERE id = ?',
    [targetFolderId, newPath, folderId]
  );

  // Update all child folders' paths
  for (const child of childFolders) {
    if (child.path) {
      const childNewPath = child.path.replace(oldPath, newPath);
      await query(
        'UPDATE folders SET path = ? WHERE id = ?',
        [childNewPath, child.id]
      );
    }
  }

  // Move physical directory
  const userPath = getUserStoragePath(userId);
  const oldPhysicalPath = path.join(userPath, oldPath);
  const newPhysicalPath = path.join(userPath, newPath);

  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(newPhysicalPath), { recursive: true });
    // Rename/move the directory
    await fs.rename(oldPhysicalPath, newPhysicalPath);
  } catch (error) {
    console.error('Error moving physical directory:', error);
    // Rollback database changes if physical move fails
    await query(
      'UPDATE folders SET parent_id = ?, path = ? WHERE id = ?',
      [sourceFolder.parent_id, oldPath, folderId]
    );
    for (const child of childFolders) {
      if (child.path) {
        await query(
          'UPDATE folders SET path = ? WHERE id = ?',
          [child.path, child.id]
        );
      }
    }
    throw new Error('Failed to move folder on disk');
  }

  // Update file paths in database
  await query(
    `UPDATE files SET path = REPLACE(path, ?, ?) 
     WHERE user_id = ? AND path LIKE ?`,
    [`user_${userId}/${oldPath}`, `user_${userId}/${newPath}`, userId, `user_${userId}/${oldPath}%`]
  );

  const updatedFolders = await query<Folder[]>('SELECT * FROM folders WHERE id = ?', [folderId]);
  return updatedFolders[0];
}

// ========================================
// 🚀 Rename File Function
// ========================================
export async function renameFile(
  fileId: number,
  userId: number,
  newName: string
): Promise<{ file: File; oldName: string; newName: string }> {
  // Validate new name
  if (!newName || newName.trim() === '') {
    throw new Error('File name cannot be empty');
  }

  // Get current file
  const files = await query<File[]>(
    'SELECT * FROM files WHERE id = ? AND user_id = ?',
    [fileId, userId]
  );

  if (!files[0]) {
    throw new Error('File not found');
  }

  const file = files[0];
  const oldName = file.original_name;
  const trimmedName = newName.trim();

  // If name is the same, no need to do anything
  if (oldName === trimmedName) {
    return { file, oldName, newName: trimmedName };
  }

  // Validate filename characters (allow Thai, alphanumeric, spaces, dots, underscores, hyphens)
  if (!/^[a-zA-Z0-9ก-๙_\-\s\.]+$/.test(trimmedName)) {
    throw new Error('Invalid file name. Only letters, numbers, Thai characters, spaces, dots, underscores and hyphens are allowed.');
  }

  // Check name length
  if (trimmedName.length > 255) {
    throw new Error('File name too long (max 255 characters)');
  }

  // Check if file with same name already exists in the same folder
  const existing = await query<File[]>(
    'SELECT * FROM files WHERE user_id = ? AND folder_id <=> ? AND original_name = ? AND id != ?',
    [userId, file.folder_id, trimmedName, fileId]
  );

  if (existing[0]) {
    throw new Error('A file with this name already exists in the same location');
  }

  // Update database - only change original_name, keep internal name (UUID) the same
  await query(
    'UPDATE files SET original_name = ?, updated_at = NOW() WHERE id = ?',
    [trimmedName, fileId]
  );

  const updatedFiles = await query<File[]>('SELECT * FROM files WHERE id = ?', [fileId]);
  return { file: updatedFiles[0], oldName, newName: trimmedName };
}

// ========================================
// 🚀 Rename Folder Function
// ========================================
export async function renameFolder(
  folderId: number,
  userId: number,
  newName: string
): Promise<{ folder: Folder; oldName: string; newName: string }> {
  // Validate new name
  if (!newName || newName.trim() === '') {
    throw new Error('Folder name cannot be empty');
  }

  const trimmedName = newName.trim();

  // Validate folder name characters
  if (!/^[a-zA-Z0-9ก-๙_\-\s\.]+$/.test(trimmedName)) {
    throw new Error('Invalid folder name. Only letters, numbers, Thai characters, spaces, dots, underscores and hyphens are allowed.');
  }

  // Check name length
  if (trimmedName.length > 255) {
    throw new Error('Folder name too long (max 255 characters)');
  }

  // Get current folder
  const folders = await query<Folder[]>(
    'SELECT * FROM folders WHERE id = ? AND user_id = ?',
    [folderId, userId]
  );

  if (!folders[0]) {
    throw new Error('Folder not found');
  }

  const folder = folders[0];
  const oldPath = folder.path;
  const oldName = folder.name;

  // If name is the same, no need to do anything
  if (oldName === trimmedName) {
    return { folder, oldName, newName: trimmedName };
  }

  // Calculate new path
  let newPath: string;
  if (folder.parent_id === null) {
    // Root level folder
    newPath = trimmedName;
  } else {
    // Nested folder - replace only the last part of the path
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = trimmedName;
    newPath = pathParts.join('/');
  }

  // Check if folder with same name already exists in the same parent
  const existing = await query<Folder[]>(
    'SELECT * FROM folders WHERE user_id = ? AND parent_id <=> ? AND name = ? AND id != ?',
    [userId, folder.parent_id, trimmedName, folderId]
  );

  if (existing[0]) {
    throw new Error('A folder with this name already exists in the same location');
  }

  // Get all child folders before updating
  const childFolders = await query<Folder[]>(
    'SELECT * FROM folders WHERE user_id = ? AND path LIKE ?',
    [userId, `${oldPath}/%`]
  );

  // Rename physical directory
  const userPath = getUserStoragePath(userId);
  const oldPhysicalPath = path.join(userPath, oldPath);
  const newPhysicalPath = path.join(userPath, newPath);

  try {
    await fs.rename(oldPhysicalPath, newPhysicalPath);
  } catch (error: any) {
    // If directory doesn't exist, just update the database
    if (error.code !== 'ENOENT') {
      console.error('Error renaming physical directory:', error);
      throw new Error('Failed to rename folder on disk');
    }
  }

  // Update the folder's name and path in database
  await query(
    'UPDATE folders SET name = ?, path = ?, updated_at = NOW() WHERE id = ?',
    [trimmedName, newPath, folderId]
  );

  // Update all child folders' paths
  for (const child of childFolders) {
    if (child.path) {
      const childNewPath = child.path.replace(oldPath, newPath);
      await query(
        'UPDATE folders SET path = ?, updated_at = NOW() WHERE id = ?',
        [childNewPath, child.id]
      );
    }
  }

  // Update file paths in database
  await query(
    `UPDATE files SET path = REPLACE(path, ?, ?), updated_at = NOW() 
     WHERE user_id = ? AND path LIKE ?`,
    [`user_${userId}/${oldPath}`, `user_${userId}/${newPath}`, userId, `user_${userId}/${oldPath}%`]
  );

  const updatedFolders = await query<Folder[]>('SELECT * FROM folders WHERE id = ?', [folderId]);
  return { folder: updatedFolders[0], oldName, newName: trimmedName };
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}