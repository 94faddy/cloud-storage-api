export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 86400; // 24 hours

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { Readable } from 'stream';
import Busboy from 'busboy';
import { Folder } from '@/types';

const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

function getStoragePath(): string {
  return path.resolve(process.cwd(), STORAGE_PATH);
}

function getUserStoragePath(userId: number): string {
  return path.join(getStoragePath(), `user_${userId}`);
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function checkStorageLimit(userId: number, fileSize: number): Promise<boolean> {
  const users = await query<any[]>(
    'SELECT storage_used, storage_limit FROM users WHERE id = ?',
    [userId]
  );
  if (!users[0]) return false;
  return (users[0].storage_used + fileSize) <= users[0].storage_limit;
}

async function updateStorageUsed(userId: number, sizeDelta: number): Promise<void> {
  await query(
    'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
    [sizeDelta, userId]
  );
}

// ============================================
// 🚀 Helper: สร้างโฟลเดอร์ตาม relativePath
// ============================================
async function createFoldersFromRelativePath(
  userId: number,
  relativePath: string,
  baseFolderId: number | null
): Promise<{ folderId: number | null; physicalPath: string }> {
  const userPath = getUserStoragePath(userId);
  
  // Helper: หา physical path จาก folder
  const getFolderPhysicalPath = async (folderId: number): Promise<string> => {
    const folders = await query<Folder[]>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [folderId, userId]
    );
    if (folders[0]) {
      // ถ้ามี path ใช้ path, ถ้าไม่มีใช้ name
      const folderPath = folders[0].path || folders[0].name;
      if (folderPath) {
        const physicalPath = path.join(userPath, folderPath);
        await ensureDir(physicalPath);
        return physicalPath;
      }
    }
    return userPath;
  };
  
  // ถ้าไม่มี relativePath ให้ใช้ baseFolderId
  if (!relativePath || relativePath === '') {
    if (baseFolderId !== null) {
      const physicalPath = await getFolderPhysicalPath(baseFolderId);
      return { folderId: baseFolderId, physicalPath };
    }
    return { folderId: null, physicalPath: userPath };
  }

  // แยก path: "FolderName/SubFolder/file.txt" -> ["FolderName", "SubFolder"]
  const folderPath = path.dirname(relativePath);
  
  if (!folderPath || folderPath === '.') {
    // ไฟล์อยู่ใน root ของโฟลเดอร์ที่อัพโหลด
    if (baseFolderId !== null) {
      const physicalPath = await getFolderPhysicalPath(baseFolderId);
      return { folderId: baseFolderId, physicalPath };
    }
    return { folderId: null, physicalPath: userPath };
  }

  // แยก folder parts
  const folderParts = folderPath.split(/[\/\\]/).filter(Boolean);
  
  if (folderParts.length === 0) {
    if (baseFolderId !== null) {
      const physicalPath = await getFolderPhysicalPath(baseFolderId);
      return { folderId: baseFolderId, physicalPath };
    }
    return { folderId: null, physicalPath: userPath };
  }

  // หา base path จาก baseFolderId
  let basePath = '';
  if (baseFolderId !== null) {
    const baseFolder = await query<Folder[]>(
      'SELECT path FROM folders WHERE id = ? AND user_id = ?',
      [baseFolderId, userId]
    );
    if (baseFolder[0] && baseFolder[0].path) {
      basePath = baseFolder[0].path;
    }
  }

  // สร้างโฟลเดอร์ทีละระดับ
  let parentId: number | null = baseFolderId;
  let currentPath = basePath;

  for (const folderName of folderParts) {
    if (!folderName) continue;

    currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

    // ตรวจสอบว่าโฟลเดอร์มีอยู่แล้วหรือไม่
    const existingFolders = await query<Folder[]>(
      'SELECT * FROM folders WHERE user_id = ? AND path = ?',
      [userId, currentPath]
    );

    if (existingFolders[0]) {
      parentId = existingFolders[0].id;
    } else {
      // สร้างโฟลเดอร์ใหม่
      const result = await query<any>(
        'INSERT INTO folders (user_id, parent_id, name, path) VALUES (?, ?, ?, ?)',
        [userId, parentId, folderName, currentPath]
      );
      parentId = result.insertId;

      // สร้าง physical directory
      const physicalFolderPath = path.join(userPath, currentPath);
      await ensureDir(physicalFolderPath);
    }
  }

  const finalPhysicalPath = path.join(userPath, currentPath);
  await ensureDir(finalPhysicalPath);

  return { folderId: parentId, physicalPath: finalPhysicalPath };
}

// ============================================
// 🚀 Public Upload Handler
// ============================================
export async function POST(request: NextRequest) {
  let tempFiles: string[] = [];
  
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    if (!auth.permissions.upload) {
      return apiError('Upload permission denied', 403);
    }

    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return apiError('Content-Type must be multipart/form-data', 400);
    }

    const body = request.body;
    if (!body) {
      return apiError('No body provided', 400);
    }

    const user = auth.user;
    const userPath = getUserStoragePath(user.id);
    await ensureDir(userPath);

    const results: any[] = [];
    const errors: string[] = [];
    
    // ========================================
    // 🔧 เก็บ field values
    // ========================================
    let folderId: number | null = null;
    
    // ⚡ แก้ไข: เก็บ relativePaths เป็น array
    const relativePaths: string[] = [];
    let fileIndex = 0;

    return new Promise<NextResponse>((resolve, reject) => {
      const busboy = Busboy({ 
        headers: { 'content-type': contentType },
        defParamCharset: 'utf8',
        limits: {
          fileSize: 100 * 1024 * 1024 * 1024,
          files: 100,
        }
      });

      const filePromises: Promise<void>[] = [];

      // ========================================
      // 🔧 รับ field values (folderId + relativePaths)
      // ========================================
      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'folderId' && value) {
          folderId = parseInt(value);
        }
        // ⚡ แก้ไข: เก็บทุก relativePaths เป็น array
        if (fieldname === 'relativePaths' && value) {
          relativePaths.push(value);
        }
      });

      busboy.on('file', (fieldname, fileStream, info) => {
        const { filename, mimeType } = info;
        
        if (!filename || filename === 'undefined') {
          fileStream.resume();
          return;
        }

        // ⚡ แก้ไข: ใช้ relativePath ตาม index ของไฟล์
        const currentFileIndex = fileIndex++;
        const currentRelativePath = relativePaths[currentFileIndex] || '';

        const filePromise = new Promise<void>(async (fileResolve, fileReject) => {
          try {
            // ========================================
            // 🚀 สร้างโฟลเดอร์ตาม relativePath
            // ========================================
            const { folderId: actualFolderId, physicalPath: targetDir } = 
              await createFoldersFromRelativePath(user.id, currentRelativePath, folderId);

            const ext = path.extname(filename);
            const storedFilename = `${uuidv4()}${ext}`;
            const filePath = path.join(targetDir, storedFilename);
            
            // สร้าง dbPath ที่ถูกต้อง
            const dbPath = path.relative(getStoragePath(), filePath);
            
            tempFiles.push(filePath);
            
            let fileSize = 0;
            const writeStream = createWriteStream(filePath);

            fileStream.on('data', (chunk: Buffer) => {
              fileSize += chunk.length;
            });

            fileStream.on('error', (err) => {
              console.error(`Stream error for ${filename}:`, err);
              errors.push(`${filename}: Stream error`);
              writeStream.destroy();
              fileResolve();
            });

            writeStream.on('error', async (err) => {
              console.error(`Write error for ${filename}:`, err);
              errors.push(`${filename}: Write error`);
              // ลบไฟล์ที่เขียนไม่สำเร็จ
              try {
                await unlink(filePath);
              } catch {}
              fileResolve();
            });

            writeStream.on('finish', async () => {
              try {
                const hasSpace = await checkStorageLimit(user.id, fileSize);
                if (!hasSpace) {
                  await unlink(filePath);
                  errors.push(`${filename}: Storage limit exceeded`);
                  fileResolve();
                  return;
                }

                const result = await query<any>(
                  `INSERT INTO files (user_id, folder_id, name, original_name, mime_type, size, path)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [user.id, actualFolderId, storedFilename, filename, mimeType || 'application/octet-stream', fileSize, dbPath]
                );

                await updateStorageUsed(user.id, fileSize);

                results.push({
                  id: result.insertId,
                  filename: storedFilename,
                  originalName: filename,
                  size: fileSize,
                  mimeType: mimeType || 'application/octet-stream',
                  path: dbPath,
                  url: `/api/public/download/${result.insertId}`,
                  folderId: actualFolderId,
                  relativePath: currentRelativePath,
                });

                await logActivity(
                  user.id,
                  'upload',
                  { filename, size: fileSize, relativePath: currentRelativePath, via: 'api' },
                  getClientIp(request),
                  getUserAgent(request)
                );

                tempFiles = tempFiles.filter(f => f !== filePath);
                
                fileResolve();
              } catch (err: any) {
                console.error(`Database error for ${filename}:`, err);
                errors.push(`${filename}: ${err.message}`);
                try {
                  await unlink(filePath);
                } catch {}
                fileResolve();
              }
            });

            fileStream.pipe(writeStream);
          } catch (err: any) {
            console.error(`Setup error for ${filename}:`, err);
            errors.push(`${filename}: ${err.message}`);
            fileStream.resume();
            fileResolve();
          }
        });

        filePromises.push(filePromise);
      });

      busboy.on('finish', async () => {
        try {
          await Promise.all(filePromises);
          
          resolve(apiResponse(
            { uploaded: results, errors },
            results.length > 0 ? 200 : 400,
            `${results.length} file(s) uploaded successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`
          ));
        } catch (err: any) {
          console.error('Busboy finish error:', err);
          resolve(apiError(err.message || 'Upload processing failed', 500));
        }
      });

      busboy.on('error', (err) => {
        console.error('Busboy error:', err);
        resolve(apiError('Failed to parse upload', 500));
      });

      const nodeStream = Readable.fromWeb(body as any);
      nodeStream.pipe(busboy);
    });

  } catch (error: any) {
    console.error('Public upload error:', error);
    
    for (const tempFile of tempFiles) {
      try {
        await unlink(tempFile);
      } catch {}
    }
    
    return apiError(error.message || 'Upload failed', 500);
  }
}