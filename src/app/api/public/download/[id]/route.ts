export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { getFile, getPublicFile } from '@/lib/storage';
import { apiError, getClientIp, getUserAgent } from '@/lib/utils';

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

    if (isPublicUrl) {
      // Public file access - no auth needed
      console.log('Fetching public file...');
      const result = await getPublicFile(id);
      console.log('Result:', result ? 'FOUND' : 'NOT FOUND');
      
      if (!result) {
        return apiError('File not found or not public', 404);
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

    const { file, buffer } = await getFile(fileId, auth.user.id);

    // Log activity
    await logActivity(
      auth.user.id,
      'download',
      { filename: file.original_name, via: 'api' },
      getClientIp(request),
      getUserAgent(request)
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': file.mime_type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_name)}"`,
        'Content-Length': file.size.toString(),
      },
    });
  } catch (error: any) {
    console.error('Public download error:', error);
    return apiError(error.message || 'Download failed', 500);
  }
}