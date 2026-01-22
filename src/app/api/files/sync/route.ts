export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

function getStoragePath(): string {
  return path.resolve(process.cwd(), STORAGE_PATH);
}

/**
 * GET /api/files/sync - ตรวจหาไฟล์ที่อยู่บน disk แต่ไม่อยู่ใน database
 * POST /api/files/sync - เพิ่มไฟล์ที่หายไปเข้า database
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user || !user.is_admin) {
      return apiError('Admin access required', 403);
    }

    const storagePath = getStoragePath();
    const userPath = path.join(storagePath, `user_${user.id}`);
    
    if (!fs.existsSync(userPath)) {
      return apiResponse({ orphanFiles: [], message: 'No user directory found' });
    }

    // ดึงไฟล์ทั้งหมดจาก database
    const dbFiles = await query<any[]>(
      'SELECT name, path FROM files WHERE user_id = ?',
      [user.id]
    );
    
    const dbFileNames = new Set(dbFiles.map(f => f.name));
    const dbFilePaths = new Set(dbFiles.map(f => f.path));

    // สแกนไฟล์บน disk (recursive)
    const orphanFiles: any[] = [];
    
    function scanDir(dir: string, relativePath: string = '') {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const itemRelativePath = relativePath ? `${relativePath}/${item}` : item;
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath, itemRelativePath);
        } else {
          const dbPath = `user_${user.id}/${itemRelativePath}`;
          
          // ตรวจสอบว่าไฟล์อยู่ใน database หรือไม่
          if (!dbFileNames.has(item) && !dbFilePaths.has(dbPath)) {
            orphanFiles.push({
              name: item,
              path: dbPath,
              fullPath: fullPath,
              relativePath: itemRelativePath,
              size: stat.size,
              mtime: stat.mtime,
            });
          }
        }
      }
    }
    
    scanDir(userPath);

    return apiResponse({
      totalDbFiles: dbFiles.length,
      orphanFiles: orphanFiles.length,
      files: orphanFiles.slice(0, 100), // แสดงแค่ 100 ไฟล์แรก
    });

  } catch (error: any) {
    console.error('Sync scan error:', error);
    return apiError(error.message || 'Failed to scan files', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user || !user.is_admin) {
      return apiError('Admin access required', 403);
    }

    const storagePath = getStoragePath();
    const userPath = path.join(storagePath, `user_${user.id}`);
    
    if (!fs.existsSync(userPath)) {
      return apiError('No user directory found', 404);
    }

    // ดึงไฟล์ทั้งหมดจาก database
    const dbFiles = await query<any[]>(
      'SELECT name, path FROM files WHERE user_id = ?',
      [user.id]
    );
    
    const dbFileNames = new Set(dbFiles.map(f => f.name));
    const dbFilePaths = new Set(dbFiles.map(f => f.path));

    // หา folders ทั้งหมด
    const folders = await query<any[]>(
      'SELECT id, path FROM folders WHERE user_id = ?',
      [user.id]
    );
    
    const folderPathToId = new Map<string, number>();
    for (const folder of folders) {
      if (folder.path) {
        folderPathToId.set(folder.path, folder.id);
      }
    }

    // สแกนและเพิ่มไฟล์ที่หายไป
    const addedFiles: any[] = [];
    const errors: string[] = [];
    let totalStorageAdded = 0;
    
    function scanAndSync(dir: string, relativePath: string = '') {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const itemRelativePath = relativePath ? `${relativePath}/${item}` : item;
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanAndSync(fullPath, itemRelativePath);
        } else {
          const dbPath = `user_${user.id}/${itemRelativePath}`;
          
          // ตรวจสอบว่าไฟล์อยู่ใน database หรือไม่
          if (!dbFileNames.has(item) && !dbFilePaths.has(dbPath)) {
            try {
              // หา folder_id
              let folderId: number | null = null;
              const dirPath = path.dirname(itemRelativePath);
              
              if (dirPath && dirPath !== '.') {
                folderId = folderPathToId.get(dirPath) || null;
              }
              
              // Detect mime type
              const ext = path.extname(item).toLowerCase();
              const mimeTypes: { [key: string]: string } = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.mp4': 'video/mp4',
                '.mkv': 'video/x-matroska',
                '.ts': 'video/mp2t',
                '.txt': 'text/plain',
                '.pdf': 'application/pdf',
                '.zip': 'application/zip',
              };
              const mimeType = mimeTypes[ext] || 'application/octet-stream';
              
              // เพิ่มลง database
              addedFiles.push({
                name: item,
                path: dbPath,
                size: stat.size,
                folderId,
                mimeType,
              });
              
              totalStorageAdded += stat.size;
            } catch (err: any) {
              errors.push(`${item}: ${err.message}`);
            }
          }
        }
      }
    }
    
    scanAndSync(userPath);
    
    // Batch insert
    for (const file of addedFiles) {
      await query(
        `INSERT INTO files (user_id, folder_id, name, original_name, mime_type, size, path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.id, file.folderId, file.name, file.name, file.mimeType, file.size, file.path]
      );
    }
    
    // Update storage used
    if (totalStorageAdded > 0) {
      await query(
        'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
        [totalStorageAdded, user.id]
      );
    }

    return apiResponse({
      added: addedFiles.length,
      files: addedFiles,
      errors,
      totalStorageAdded,
    }, 200, `Added ${addedFiles.length} files to database`);

  } catch (error: any) {
    console.error('Sync error:', error);
    return apiError(error.message || 'Failed to sync files', 500);
  }
}