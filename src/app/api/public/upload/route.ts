export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { saveFile } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { UploadResult } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    if (!auth.permissions.upload) {
      return apiError('Upload permission denied', 403);
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const folderId = formData.get('folderId') as string | null;
    const relativePaths = formData.getAll('relativePaths') as string[];

    if (!files || files.length === 0) {
      return apiError('No files provided', 400);
    }

    const results: UploadResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = relativePaths[i] || '';

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const savedFile = await saveFile(
          auth.user.id,
          buffer,
          file.name,
          folderId ? parseInt(folderId) : null,
          relativePath
        );

        results.push({
          filename: savedFile.name,
          originalName: savedFile.original_name,
          size: savedFile.size,
          mimeType: savedFile.mime_type,
          path: savedFile.path,
          url: `/api/public/download/${savedFile.id}`,
        });

        // Log activity
        await logActivity(
          auth.user.id,
          'upload',
          { filename: savedFile.original_name, size: savedFile.size, via: 'api' },
          getClientIp(request),
          getUserAgent(request)
        );
      } catch (error: any) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }

    return apiResponse(
      { uploaded: results, errors },
      results.length > 0 ? 200 : 400,
      `${results.length} file(s) uploaded successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`
    );
  } catch (error: any) {
    console.error('Public upload error:', error);
    return apiError(error.message || 'Upload failed', 500);
  }
}