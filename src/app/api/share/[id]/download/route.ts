export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSharedContent } from '@/lib/storage';
import { apiError } from '@/lib/utils';
import { File, Folder } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

function getStoragePath(): string {
  return path.resolve(process.cwd(), STORAGE_PATH);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shareId = params.id;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    // Get shared content info first
    const sharedContent = await getSharedContent(shareId);

    if (!sharedContent) {
      return apiError('Shared content not found or no longer available', 404);
    }

    let targetFile: File | null = null;

    // If it's a direct file share
    if (sharedContent.type === 'file') {
      targetFile = sharedContent.item as File;
    }
    // If it's a folder share and fileId is provided
    else if (sharedContent.type === 'folder' && fileId) {
      const folder = sharedContent.item as Folder;
      
      // Verify the file belongs to this shared folder or its subfolders
      const files = await query<File[]>(
        `SELECT * FROM files WHERE id = ? AND user_id = ? AND (
          folder_id = ? OR folder_id IN (
            SELECT id FROM folders WHERE user_id = ? AND path LIKE ?
          )
        )`,
        [parseInt(fileId), folder.user_id, folder.id, folder.user_id, `${folder.path}/%`]
      );

      if (!files[0]) {
        return apiError('File not found in shared folder', 404);
      }

      targetFile = files[0];
    }

    if (!targetFile) {
      return apiError('Invalid request', 400);
    }

    // Get file path on disk
    const filePath = path.join(getStoragePath(), targetFile.path);

    if (!fs.existsSync(filePath)) {
      return apiError('File not found on disk', 404);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // ========================================
    // Handle Range Requests (Resume Download)
    // ========================================
    const rangeHeader = request.headers.get('range');
    
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      // Validate range
      if (start >= fileSize || end >= fileSize || start > end || isNaN(start)) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      
      // Stream from disk
      const fileStream = fs.createReadStream(filePath, { start, end });

      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            controller.enqueue(new Uint8Array(buffer));
          });
          fileStream.on('end', () => {
            controller.close();
          });
          fileStream.on('error', (err) => {
            console.error('Stream error:', err);
            controller.error(err);
          });
        },
        cancel() {
          fileStream.destroy();
        },
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Type': targetFile.mime_type || 'application/octet-stream',
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(targetFile.original_name)}"`,
        },
      });
    }

    // ========================================
    // Full File Download with Streaming
    // ========================================
    const fileStream = fs.createReadStream(filePath);
    
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          controller.enqueue(new Uint8Array(buffer));
        });
        fileStream.on('end', () => {
          controller.close();
        });
        fileStream.on('error', (err) => {
          console.error('Stream error:', err);
          controller.error(err);
        });
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': targetFile.mime_type || 'application/octet-stream',
        'Content-Length': fileSize.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(targetFile.original_name)}"`,
        'Accept-Ranges': 'bytes',
      },
    });

  } catch (error: any) {
    console.error('Download shared content error:', error);
    return apiError(error.message || 'Download failed', 500);
  }
}