export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { setFolderPublic } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { folderId, isPublic } = body;

    if (!folderId) {
      return apiError('Folder ID is required', 400);
    }

    const folder = await setFolderPublic(
      parseInt(folderId),
      user.id,
      isPublic !== false
    );

    // Log activity
    await logActivity(
      user.id,
      isPublic ? 'share_folder' : 'unshare_folder',
      { name: folder.name, publicUrl: folder.public_url },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(folder, 200, isPublic ? 'Folder shared successfully' : 'Folder unshared');
  } catch (error: any) {
    console.error('Share folder error:', error);
    return apiError(error.message || 'Failed to share folder', 500);
  }
}
