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

    // If it's a direct file share
    if (sharedContent.type === 'file') {
      const file = sharedContent.item as File;
      const result = await getFileById(file.id);
      
      if (!result) {
        return apiError('File not found', 404);
      }

      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          'Content-Type': result.file.mime_type,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.file.original_name)}"`,
          'Content-Length': result.file.size.toString(),
        },
      });
    }

    // If it's a folder share and fileId is provided
    if (sharedContent.type === 'folder' && fileId) {
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

      const result = await getFileById(files[0].id);
      
      if (!result) {
        return apiError('File not found', 404);
      }

      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          'Content-Type': result.file.mime_type,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.file.original_name)}"`,
          'Content-Length': result.file.size.toString(),
        },
      });
    }

    return apiError('Invalid request', 400);
  } catch (error: any) {
    console.error('Download shared content error:', error);
    return apiError(error.message || 'Download failed', 500);
  }
}
