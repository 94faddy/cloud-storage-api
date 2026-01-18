export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
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
  context: { params: { id: string } }
) {
  try {
    const id = context.params.id;
    console.log('=== Public download request ===');
    console.log('ID:', id);

    // Check if this is a public URL (UUID format) or file ID
    const isPublicUrl = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    console.log('Is UUID format:', isPublicUrl);

    let targetFile: File | null = null;

    if (isPublicUrl) {
      // Public file access - no auth needed
      console.log('Fetching public file...');
      const files = await query<File[]>(
        'SELECT * FROM files WHERE public_url = ? AND is_public = 1',
        [id]
      );
      
      if (!files[0]) {
        return apiError('File not found or not public', 404);
      }
      
      targetFile = files[0];
    } else {
      // Private file access - requires API key
      const auth = await validateApiKey(request);
      
      if (!auth) {
        return apiError('Invalid or missing API key', 401);
      }

      if (!auth.permissions.download) {
        return apiError('Download permission denied', 403);
      }

      const fileId = parseInt(id);
      if (isNaN(fileId)) {
        return apiError('Invalid file ID', 400);
      }

      const files = await query<File[]>(
        'SELECT * FROM files WHERE id = ? AND user_id = ?',
        [fileId, auth.user.id]
      );

      if (!files[0]) {
        return apiError('File not found', 404);
      }

      targetFile = files[0];

      // Log activity
      await logActivity(
        auth.user.id,
        'download',
        { filename: targetFile.original_name, via: 'api' },
        getClientIp(request),
        getUserAgent(request)
      );
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
          'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(targetFile.original_name)}`,
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
        'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(targetFile.original_name)}`,
        'Accept-Ranges': 'bytes',
      },
    });

  } catch (error: any) {
    console.error('Public download error:', error);
    return apiError(error.message || 'Download failed', 500);
  }
}