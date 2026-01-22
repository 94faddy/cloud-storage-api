export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { File } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

function getStoragePath(): string {
  return path.resolve(process.cwd(), STORAGE_PATH);
}

/**
 * CDN Direct URL - เข้าถึงไฟล์ Public โดยตรง ไม่ต้องใช้ API Key
 * 
 * URL Format: /api/cdn/{public_url}
 * - ใช้ public_url (UUID) ที่ได้จากการ share ไฟล์
 * - ไม่ต้อง auth / API Key
 * - รองรับ Range requests (resume download, video streaming)
 * - รองรับ Cache headers สำหรับ CDN
 * 
 * Query params:
 * - download=1 : บังคับ download (Content-Disposition: attachment)
 * - inline=1   : แสดงในเบราว์เซอร์ (Content-Disposition: inline)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const publicUrl = params.id;
    const { searchParams } = new URL(request.url);
    const forceDownload = searchParams.get('download') === '1';
    const forceInline = searchParams.get('inline') === '1';

    // ค้นหาไฟล์ที่เป็น public
    const files = await query<File[]>(
      'SELECT * FROM files WHERE public_url = ? AND is_public = 1',
      [publicUrl]
    );

    if (!files[0]) {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: 'File not found or not public' 
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const file = files[0];
    const filePath = path.join(getStoragePath(), file.path);

    // ตรวจสอบไฟล์มีอยู่จริง
    if (!fs.existsSync(filePath)) {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: 'File not found on disk' 
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType = file.mime_type || 'application/octet-stream';

    // กำหนด Content-Disposition
    let disposition = 'inline';
    if (forceDownload) {
      disposition = 'attachment';
    } else if (!forceInline) {
      // Auto-detect: inline สำหรับ media, attachment สำหรับไฟล์อื่น
      const inlineTypes = [
        'image/', 'video/', 'audio/', 
        'text/plain', 'text/html', 'text/css', 'text/javascript',
        'application/pdf', 'application/json'
      ];
      if (!inlineTypes.some(t => mimeType.startsWith(t))) {
        disposition = 'attachment';
      }
    }

    // Cache headers สำหรับ CDN
    const cacheHeaders = {
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
      'CDN-Cache-Control': 'public, max-age=31536000',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000',
      'ETag': `"${file.id}-${stat.mtimeMs}"`,
      'Last-Modified': stat.mtime.toUTCString(),
    };

    // ตรวจสอบ ETag / If-None-Match
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === cacheHeaders['ETag']) {
      return new NextResponse(null, { status: 304, headers: cacheHeaders });
    }

    // ========================================
    // Handle Range Requests (Video Streaming / Resume)
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
            ...cacheHeaders
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            controller.enqueue(new Uint8Array(buffer));
          });
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        },
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `${disposition}; filename="download"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
          ...cacheHeaders
        },
      });
    }

    // ========================================
    // Full File Download / Streaming
    // ========================================
    const fileStream = fs.createReadStream(filePath);
    
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          controller.enqueue(new Uint8Array(buffer));
        });
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileSize.toString(),
        'Content-Disposition': `${disposition}; filename="download"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
        'Accept-Ranges': 'bytes',
        ...cacheHeaders
      },
    });

  } catch (error: any) {
    console.error('CDN file error:', error);
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * HEAD request - ดูข้อมูลไฟล์โดยไม่ดาวน์โหลด
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const publicUrl = params.id;

    const files = await query<File[]>(
      'SELECT * FROM files WHERE public_url = ? AND is_public = 1',
      [publicUrl]
    );

    if (!files[0]) {
      return new NextResponse(null, { status: 404 });
    }

    const file = files[0];
    const filePath = path.join(getStoragePath(), file.path);

    if (!fs.existsSync(filePath)) {
      return new NextResponse(null, { status: 404 });
    }

    const stat = fs.statSync(filePath);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Length': stat.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': `"${file.id}-${stat.mtimeMs}"`,
        'Last-Modified': stat.mtime.toUTCString(),
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}