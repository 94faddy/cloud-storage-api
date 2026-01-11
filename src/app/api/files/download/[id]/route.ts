export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { getFile } from '@/lib/storage';
import { apiError, getClientIp, getUserAgent } from '@/lib/utils';

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

    const { file, buffer } = await getFile(fileId, user.id);

    // Log activity
    await logActivity(
      user.id,
      'download',
      { filename: file.original_name },
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
    console.error('Download error:', error);
    return apiError(error.message || 'Download failed', 500);
  }
}