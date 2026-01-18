export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { query } from '@/lib/db';
import { File } from '@/types';
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
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const fileId = parseInt(params.id);
    if (isNaN(fileId)) {
      return apiError('Invalid file ID', 400);
    }

    // Get file info from database
    const files = await query<File[]>(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [fileId, user.id]
    );

    if (!files[0]) {
      return apiError('File not found', 404);
    }

    const file = files[0];

    // Get file path on disk
    const filePath = path.join(getStoragePath(), file.path);

    if (!fs.existsSync(filePath)) {
      return apiError('File not found on disk', 404);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // Log activity
    await logActivity(
      user.id,
      'download',
      { filename: file.original_name },
      getClientIp(request),
      getUserAgent(request)
    );

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
          'Content-Type': file.mime_type || 'application/octet-stream',
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
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
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Length': fileSize.toString(),
        'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
        'Accept-Ranges': 'bytes',
      },
    });

  } catch (error: any) {
    console.error('Download error:', error);
    return apiError(error.message || 'Download failed', 500);
  }
}