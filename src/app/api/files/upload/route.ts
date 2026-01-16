export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 86400; // 24 hours

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { Readable } from 'stream';
import Busboy from 'busboy';

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
// 🚀 Streaming Upload Handler
// ============================================
export async function POST(request: NextRequest) {
  let tempFiles: string[] = [];
  
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return apiError('Content-Type must be multipart/form-data', 400);
    }

    const body = request.body;
    if (!body) {
      return apiError('No body provided', 400);
    }

    const userPath = getUserStoragePath(user.id);
    await ensureDir(userPath);

    const results: any[] = [];
    const errors: string[] = [];
    let folderId: number | null = null;

    return new Promise<NextResponse>((resolve, reject) => {
      const busboy = Busboy({ 
        headers: { 'content-type': contentType },
        limits: {
          fileSize: 100 * 1024 * 1024 * 1024, // 100GB per file
          files: 100,
        }
      });

      const filePromises: Promise<void>[] = [];

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'folderId' && value) {
          folderId = parseInt(value);
        }
      });

      busboy.on('file', (fieldname, fileStream, info) => {
        const { filename, mimeType } = info;
        
        if (!filename || filename === 'undefined') {
          fileStream.resume();
          return;
        }

        const ext = path.extname(filename);
        const storedFilename = `${uuidv4()}${ext}`;
        const filePath = path.join(userPath, storedFilename);
        const dbPath = `user_${user.id}/${storedFilename}`;
        
        tempFiles.push(filePath);
        
        let fileSize = 0;
        const writeStream = createWriteStream(filePath);

        const filePromise = new Promise<void>((fileResolve, fileReject) => {
          fileStream.on('data', (chunk: Buffer) => {
            fileSize += chunk.length;
          });

          fileStream.on('error', (err) => {
            console.error(`Stream error for ${filename}:`, err);
            errors.push(`${filename}: Stream error`);
            writeStream.destroy();
            fileReject(err);
          });

          writeStream.on('error', (err) => {
            console.error(`Write error for ${filename}:`, err);
            errors.push(`${filename}: Write error`);
            fileReject(err);
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

              let actualFolderId = folderId;
              if (folderId) {
                const folders = await query<any[]>(
                  'SELECT id FROM folders WHERE id = ? AND user_id = ?',
                  [folderId, user.id]
                );
                if (!folders[0]) {
                  actualFolderId = null;
                }
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
                url: `/api/files/download/${result.insertId}`,
              });

              await logActivity(
                user.id,
                'upload',
                { filename, size: fileSize },
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
    console.error('Upload error:', error);
    
    for (const tempFile of tempFiles) {
      try {
        await unlink(tempFile);
      } catch {}
    }
    
    return apiError(error.message || 'Upload failed', 500);
  }
}