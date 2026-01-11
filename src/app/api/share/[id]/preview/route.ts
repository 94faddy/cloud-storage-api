export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getFileById, getSharedContent } from '@/lib/storage';
import { apiError } from '@/lib/utils';
import { File, Folder } from '@/types';

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

    const result = await getFileById(targetFile.id);
    
    if (!result) {
      return apiError('File not found', 404);
    }

    // Handle range requests for video/audio streaming
    const range = request.headers.get('range');
    const fileSize = result.buffer.length;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const chunk = result.buffer.slice(start, end + 1);

      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': result.file.mime_type,
        },
      });
    }

    // Determine content disposition based on file type
    const isPreviewable = isPreviewableType(result.file.mime_type, result.file.original_name);
    const disposition = isPreviewable ? 'inline' : 'attachment';
    const contentType = getCorrectMimeType(result.file.mime_type, result.file.original_name);

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(result.file.original_name)}"`,
        'Content-Length': result.file.size.toString(),
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

  // ตรวจสอบ mime type ปกติ
  if (previewableTypes.some(type => mimeType.startsWith(type.split('/')[0] + '/') || mimeType === type)) {
    return true;
  }

  // ตรวจสอบ extension สำหรับไฟล์ text-based
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
  // ถ้า mime type ไม่ใช่ octet-stream ให้ใช้ค่าเดิม
  if (originalMimeType !== 'application/octet-stream') {
    return originalMimeType;
  }

  // ตรวจสอบ extension และกำหนด mime type ที่ถูกต้อง
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  const mimeMap: { [key: string]: string } = {
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