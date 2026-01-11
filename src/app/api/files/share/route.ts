export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { setFilePublic } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { fileId, isPublic } = body;

    if (!fileId) {
      return apiError('File ID is required', 400);
    }

    const file = await setFilePublic(
      parseInt(fileId),
      user.id,
      isPublic !== false
    );

    // Log activity
    await logActivity(
      user.id,
      isPublic ? 'share' : 'unshare',
      { filename: file.original_name, publicUrl: file.public_url },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(file, 200, isPublic ? 'File shared successfully' : 'File unshared');
  } catch (error: any) {
    console.error('Share file error:', error);
    return apiError(error.message || 'Failed to share file', 500);
  }
}
