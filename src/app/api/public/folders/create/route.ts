export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { createFolder } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    if (!auth.permissions.createFolder) {
      return apiError('Create folder permission denied', 403);
    }

    const body = await request.json();
    const { name, parentId } = body;

    if (!name) {
      return apiError('Folder name is required', 400);
    }

    if (!/^[a-zA-Z0-9ก-๙_\-\s\.]+$/.test(name)) {
      return apiError('Invalid folder name', 400);
    }

    if (name.length > 255) {
      return apiError('Folder name too long', 400);
    }

    const folder = await createFolder(
      auth.user.id,
      name,
      parentId ? parseInt(parentId) : null
    );

    await logActivity(
      auth.user.id,
      'create_folder',
      { name: folder.name, parentId, via: 'api' },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(folder, 201, 'Folder created successfully');
  } catch (error: any) {
    console.error('Public create folder error:', error);
    return apiError(error.message || 'Failed to create folder', 500);
  }
}