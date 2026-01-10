import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { saveFile } from '@/lib/storage';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { UploadResult } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const formData = await request.formData();
    
    // Support both 'files' and 'file' field names
    let fileEntries = formData.getAll('files');
    if (fileEntries.length === 0) {
      fileEntries = formData.getAll('file');
    }
    
    const folderId = formData.get('folderId') as string | null;
    const relativePaths = formData.getAll('relativePaths') as string[];

    // Filter out non-File entries and empty files
    const files: File[] = [];
    for (const entry of fileEntries) {
      if (entry instanceof File && entry.size > 0 && entry.name && entry.name !== 'undefined') {
        files.push(entry);
      }
    }

    console.log('Upload request:', {
      entriesCount: fileEntries.length,
      validFilesCount: files.length,
      folderId,
      fileNames: files.map(f => f.name)
    });

    if (files.length === 0) {
      return apiError('No valid files provided', 400);
    }

    const results: UploadResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = relativePaths[i] || '';

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Extract just the filename from path (for folder uploads)
        const fileName = file.name.includes('/') 
          ? file.name.split('/').pop() || file.name 
          : file.name;
        
        console.log('Saving file:', { fileName, originalName: file.name, size: buffer.length, relativePath });
        
        const savedFile = await saveFile(
          user.id,
          buffer,
          fileName,
          folderId ? parseInt(folderId) : null,
          relativePath
        );

        results.push({
          filename: savedFile.name,
          originalName: savedFile.original_name,
          size: savedFile.size,
          mimeType: savedFile.mime_type,
          path: savedFile.path,
          url: `/api/files/download/${savedFile.id}`,
        });

        // Log activity
        await logActivity(
          user.id,
          'upload',
          { filename: savedFile.original_name, size: savedFile.size },
          getClientIp(request),
          getUserAgent(request)
        );
      } catch (error: any) {
        console.error('Save file error:', error);
        errors.push(`${file.name}: ${error.message}`);
      }
    }

    console.log('Upload results:', { uploaded: results.length, errors });

    return apiResponse(
      { uploaded: results, errors },
      results.length > 0 ? 200 : 400,
      `${results.length} file(s) uploaded successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`
    );
  } catch (error: any) {
    console.error('Upload error:', error);
    return apiError(error.message || 'Upload failed', 500);
  }
}