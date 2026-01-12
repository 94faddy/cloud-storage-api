export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSharedContent } from '@/lib/storage';
import { apiError } from '@/lib/utils';
import { File, Folder } from '@/types';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

function getStoragePath(): string {
  return path.resolve(process.cwd(), STORAGE_PATH);
}

// Get all files recursively from a folder
async function getAllFilesInFolder(folderId: number, userId: number): Promise<{ file: File; relativePath: string }[]> {
  const results: { file: File; relativePath: string }[] = [];
  
  // Get the root folder info
  const rootFolders = await query<Folder[]>(
    'SELECT * FROM folders WHERE id = ? AND user_id = ?',
    [folderId, userId]
  );
  
  if (!rootFolders[0]) return results;
  
  const rootFolder = rootFolders[0];
  const rootPath = rootFolder.path;
  
  // Get all files directly in this folder
  const directFiles = await query<File[]>(
    'SELECT * FROM files WHERE folder_id = ? AND user_id = ?',
    [folderId, userId]
  );
  
  for (const file of directFiles) {
    results.push({ file, relativePath: file.original_name });
  }
  
  // Get all subfolders recursively
  const subfolders = await query<Folder[]>(
    'SELECT * FROM folders WHERE user_id = ? AND path LIKE ?',
    [userId, `${rootPath}/%`]
  );
  
  for (const subfolder of subfolders) {
    // Calculate relative path from root folder
    const relativeFolderPath = subfolder.path.substring(rootPath.length + 1);
    
    // Get files in this subfolder
    const subFiles = await query<File[]>(
      'SELECT * FROM files WHERE folder_id = ? AND user_id = ?',
      [subfolder.id, userId]
    );
    
    for (const file of subFiles) {
      results.push({ 
        file, 
        relativePath: `${relativeFolderPath}/${file.original_name}` 
      });
    }
  }
  
  return results;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tempZipPath = path.join(getStoragePath(), `temp_${uuidv4()}.zip`);
  
  try {
    const shareId = params.id;
    const { searchParams } = new URL(request.url);
    const subPath = searchParams.get('path') || '';

    // Get shared content info
    const sharedContent = await getSharedContent(shareId);

    if (!sharedContent) {
      return apiError('Shared content not found or no longer available', 404);
    }

    if (sharedContent.type !== 'folder') {
      return apiError('This is not a folder share', 400);
    }

    const folder = sharedContent.item as Folder;
    let targetFolderId = folder.id;
    let folderName = folder.name;

    // If subPath is provided, find the actual subfolder
    if (subPath) {
      const fullPath = `${folder.path}/${subPath}`;
      const subFolder = await query<Folder[]>(
        'SELECT * FROM folders WHERE user_id = ? AND path = ?',
        [folder.user_id, fullPath]
      );

      if (subFolder[0]) {
        targetFolderId = subFolder[0].id;
        folderName = subFolder[0].name;
      } else {
        return apiError('Subfolder not found', 404);
      }
    }

    // Get all files in the folder
    const filesWithPaths = await getAllFilesInFolder(targetFolderId, folder.user_id);

    if (filesWithPaths.length === 0) {
      return apiError('Folder is empty', 400);
    }

    // Create ZIP file
    const output = fs.createWriteStream(tempZipPath);
    const archive = archiver('zip', {
      zlib: { level: 5 } // Compression level (0-9)
    });

    // Wait for the archive to finish
    const archivePromise = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);

    // Add files to archive
    for (const { file, relativePath } of filesWithPaths) {
      const filePath = path.join(getStoragePath(), file.path);
      
      // Check if file exists
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: relativePath });
      }
    }

    await archive.finalize();
    await archivePromise;

    // Read the ZIP file
    const zipBuffer = fs.readFileSync(tempZipPath);
    const zipSize = zipBuffer.length;

    // Delete temp ZIP file immediately after reading
    try {
      fs.unlinkSync(tempZipPath);
    } catch (e) {
      console.error('Error deleting temp zip:', e);
    }

    // Send response
    const sanitizedFolderName = folderName.replace(/[^a-zA-Z0-9ก-๙_\-\s\.]/g, '_');
    
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(sanitizedFolderName)}.zip"`,
        'Content-Length': zipSize.toString(),
      },
    });

  } catch (error: any) {
    console.error('Download folder error:', error);
    
    // Clean up temp file on error
    try {
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
    } catch (e) {
      console.error('Error cleaning up temp zip:', e);
    }
    
    return apiError(error.message || 'Download failed', 500);
  }
}