export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { createFolder } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { name, parentId } = body;

    if (!name) {
      return apiError('Folder name is required', 400);
    }

    // Validate folder name - allow Thai characters, alphanumeric, spaces, dots, underscores, hyphens
    if (!/^[a-zA-Z0-9ก-๙_\-\s\.]+$/.test(name)) {
      return apiError('Invalid folder name', 400);
    }

    // Check name length
    if (name.length > 255) {
      return apiError('Folder name too long', 400);
    }

    const folder = await createFolder(
      user.id,
      name,
      parentId ? parseInt(parentId) : null
    );

    // Log activity
    await logActivity(
      user.id,
      'create_folder',
      { name: folder.name, parentId },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(folder, 201, 'Folder created successfully');
  } catch (error: any) {
    console.error('Create folder error:', error);
    return apiError(error.message || 'Failed to create folder', 500);
  }
}