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
    const mimeType = getCorrectMimeType(targetFile.mime_type, targetFile.original_name);
    const rangeHeader = request.headers.get('range');

    // ========================================
    // Handle Range Requests for Video/Audio (Streaming)
    // ========================================
    if (rangeHeader && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024 - 1, fileSize - 1); // 1MB chunks
      
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
      
      // Stream from disk directly
      const fileStream = fs.createReadStream(filePath, { start, end });

      // Convert Node.js stream to Web stream
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
          'Content-Type': mimeType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // ========================================
    // Handle Full File Request
    // ========================================
    const isPreviewable = isPreviewableType(mimeType, targetFile.original_name);
    const disposition = isPreviewable ? 'inline' : 'attachment';

    // For small files (< 10MB), read entire file
    if (fileSize < 10 * 1024 * 1024) {
      const fileBuffer = fs.readFileSync(filePath);
      
      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileSize.toString(),
          'Content-Disposition': `${disposition}; filename="file"; filename*=UTF-8''${encodeURIComponent(targetFile.original_name)}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // For larger files, use streaming
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
        'Content-Type': mimeType,
        'Content-Length': fileSize.toString(),
        'Content-Disposition': `${disposition}; filename="file"; filename*=UTF-8''${encodeURIComponent(targetFile.original_name)}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error: any) {
    console.error('Preview shared content error:', error);
    return apiError(error.message || 'Preview failed', 500);
  }
}

function isPreviewableType(mimeType: string, fileName: string = ''): boolean {
  const previewableTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
    // Videos
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3', 'audio/aac',
    // Documents
    'application/pdf',
    // Text
    'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/csv', 'text/xml',
    'application/json', 'application/xml', 'application/javascript',
  ];

  if (previewableTypes.some(type => mimeType.startsWith(type.split('/')[0] + '/') || mimeType === type)) {
    return true;
  }

  if (isTextBasedExtension(fileName)) {
    return true;
  }

  return false;
}

function isTextBasedExtension(fileName: string): boolean {
  const textExtensions = [
    '.txt', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.tsx', 
    '.jsx', '.vue', '.svelte', '.php', '.py', '.rb', '.java', '.c', '.cpp', 
    '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.kt', '.scala', '.sh', 
    '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.yaml', '.yml', 
    '.toml', '.ini', '.conf', '.config', '.env', '.gitignore', '.dockerignore',
    '.md', '.markdown', '.rst', '.tex', '.sql', '.graphql', '.prisma',
    '.ejs', '.hbs', '.pug', '.jade', '.twig', '.blade.php', '.erb',
    '.sass', '.scss', '.less', '.styl', '.csv', '.tsv', '.log',
    '.htaccess', '.nginx', '.apache', '.r', '.R', '.m', '.lua', '.perl', '.pl', '.pm'
  ];
  
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return textExtensions.includes(ext);
}

function getCorrectMimeType(originalMimeType: string, fileName: string): string {
  if (originalMimeType !== 'application/octet-stream') {
    return originalMimeType;
  }

  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  const mimeMap: { [key: string]: string } = {
    // Video
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    // Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    // Code/Text
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.jsx': 'text/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.xml': 'application/xml',
    '.svg': 'image/svg+xml',
    '.md': 'text/markdown',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.ejs': 'text/plain',
    '.hbs': 'text/plain',
    '.pug': 'text/plain',
    '.vue': 'text/plain',
    '.svelte': 'text/plain',
    '.php': 'text/plain',
    '.py': 'text/plain',
    '.rb': 'text/plain',
    '.java': 'text/plain',
    '.c': 'text/plain',
    '.cpp': 'text/plain',
    '.h': 'text/plain',
    '.go': 'text/plain',
    '.rs': 'text/plain',
    '.swift': 'text/plain',
    '.kt': 'text/plain',
    '.sql': 'text/plain',
    '.sh': 'text/plain',
    '.bash': 'text/plain',
    '.env': 'text/plain',
    '.gitignore': 'text/plain',
    '.log': 'text/plain',
    '.csv': 'text/csv',
    '.tsv': 'text/tab-separated-values',
  };

  return mimeMap[ext] || (isTextBasedExtension(fileName) ? 'text/plain' : originalMimeType);
}