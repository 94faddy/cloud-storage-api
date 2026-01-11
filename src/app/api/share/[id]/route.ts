export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSharedContent, getSharedFolderContents } from '@/lib/storage';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shareId = params.id;
    const { searchParams } = new URL(request.url);
    const subPath = searchParams.get('path') || '';

    // Get shared content info
    const sharedContent = await getSharedContent(shareId);

    if (!sharedContent) {
      return apiError('Shared content not found or no longer available', 404);
    }

    // If it's a folder, also get contents
    if (sharedContent.type === 'folder') {
      const contents = await getSharedFolderContents(
        sharedContent.item.id,
        subPath
      );

      return apiResponse({
        ...sharedContent,
        contents
      });
    }

    return apiResponse(sharedContent);
  } catch (error: any) {
    console.error('Get shared content error:', error);
    return apiError(error.message || 'Failed to get shared content', 500);
  }
}
