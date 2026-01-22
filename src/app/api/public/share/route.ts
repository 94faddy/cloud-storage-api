export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { validateApiKey, logActivity } from '@/lib/auth';
import { setFilePublic, setFolderPublic } from '@/lib/storage';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { File, Folder } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://apiv1.nexzcloud.lol';
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn-asia1.nexzcloud.lol';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexzcloud.lol';

// Helper function สร้าง CDN URL พร้อม prefix
function buildCdnUrl(cdnPrefix: string | null, publicUrl: string): string {
  if (cdnPrefix) {
    return `${CDN_URL}/@${cdnPrefix}/${publicUrl}`;
  }
  return `${CDN_URL}/${publicUrl}`;
}

/**
 * Public Share API - Share/Unshare ไฟล์หรือโฟลเดอร์ผ่าน API Key
 * 
 * POST /api/public/share
 * 
 * Request body:
 * - type: 'file' | 'folder'
 * - id: number (File ID หรือ Folder ID)
 * - isPublic: boolean (true = share, false = unshare)
 * 
 * ต้องมี permission: upload หรือ delete
 * 
 * CDN URL Format: https://cdn-asia1.nexzcloud.lol/@{api_key_name}/{uuid}
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API Key
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    const { permissions, user, apiKey } = auth;

    // ต้องมี permission upload หรือ delete
    if (!permissions.upload && !permissions.delete) {
      return apiError('Insufficient permissions. Requires upload or delete permission.', 403);
    }

    const body = await request.json();
    const { type, id, isPublic } = body;

    // Validate input
    if (!type || !['file', 'folder'].includes(type)) {
      return apiError('Invalid type. Must be "file" or "folder"', 400);
    }

    if (!id || typeof id !== 'number') {
      return apiError('Invalid ID. Must be a number', 400);
    }

    let result: File | Folder;
    let cdnUrl: string | null = null;
    let shareUrl: string | null = null;

    if (type === 'file') {
      // Share/Unshare file - ส่งชื่อ API Key เป็น cdn_prefix
      result = await setFilePublic(id, user.id, isPublic !== false, apiKey.name);
      
      if (result.is_public && result.public_url) {
        // CDN URL พร้อม prefix: /@bevchat/uuid
        cdnUrl = buildCdnUrl((result as File).cdn_prefix, result.public_url);
        shareUrl = `${APP_URL}/share/${result.public_url}`;
      }

      // Log activity
      await logActivity(
        user.id,
        isPublic ? 'api_share_file' : 'api_unshare_file',
        { 
          fileId: id, 
          name: (result as File).original_name,
          publicUrl: result.public_url,
          cdnPrefix: (result as File).cdn_prefix,
          cdnUrl 
        },
        getClientIp(request),
        getUserAgent(request)
      );

      return apiResponse({
        type: 'file',
        id: result.id,
        name: (result as File).original_name,
        mimeType: (result as File).mime_type,
        size: (result as File).size,
        isPublic: result.is_public,
        publicUrl: result.public_url,
        cdnPrefix: (result as File).cdn_prefix,
        cdnUrl,
        shareUrl,
        // URL ต่างๆ ที่ใช้ได้
        urls: result.is_public ? {
          // CDN Direct - ไม่ต้อง auth, เหมาะสำหรับ embed
          cdn: cdnUrl,
          // CDN with download flag
          cdnDownload: `${cdnUrl}?download=1`,
          // Share page - หน้า preview
          share: shareUrl,
          // Share download - ดาวน์โหลดจากหน้า share
          shareDownload: `${API_URL}/api/share/${result.public_url}/download`,
        } : null
      }, 200, isPublic ? 'File shared successfully' : 'File unshared');

    } else {
      // Share/Unshare folder
      result = await setFolderPublic(id, user.id, isPublic !== false);

      if (result.is_public && result.public_url) {
        shareUrl = `${APP_URL}/share/${result.public_url}`;
      }

      // Log activity
      await logActivity(
        user.id,
        isPublic ? 'api_share_folder' : 'api_unshare_folder',
        { 
          folderId: id, 
          name: (result as Folder).name,
          publicUrl: result.public_url 
        },
        getClientIp(request),
        getUserAgent(request)
      );

      return apiResponse({
        type: 'folder',
        id: result.id,
        name: (result as Folder).name,
        path: (result as Folder).path,
        isPublic: result.is_public,
        publicUrl: result.public_url,
        shareUrl,
        urls: result.is_public ? {
          share: shareUrl,
        } : null
      }, 200, isPublic ? 'Folder shared successfully' : 'Folder unshared');
    }

  } catch (error: any) {
    console.error('Public share error:', error);
    return apiError(error.message || 'Failed to share', 500);
  }
}

/**
 * GET /api/public/share - ดูรายการไฟล์/โฟลเดอร์ที่แชร์อยู่
 * 
 * Query params:
 * - type: 'file' | 'folder' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API Key
    const auth = await validateApiKey(request);
    
    if (!auth) {
      return apiError('Invalid or missing API key', 401);
    }

    const { permissions, user } = auth;

    // ต้องมี permission list
    if (!permissions.list) {
      return apiError('Insufficient permissions. Requires list permission.', 403);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const result: { files?: any[]; folders?: any[] } = {};

    if (type === 'all' || type === 'file') {
      const files = await query<File[]>(
        'SELECT * FROM files WHERE user_id = ? AND is_public = 1 ORDER BY updated_at DESC',
        [user.id]
      );

      result.files = files.map(f => ({
        id: f.id,
        name: f.original_name,
        mimeType: f.mime_type,
        size: f.size,
        publicUrl: f.public_url,
        cdnPrefix: f.cdn_prefix,
        cdnUrl: buildCdnUrl(f.cdn_prefix, f.public_url!),
        shareUrl: `${APP_URL}/share/${f.public_url}`,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }));
    }

    if (type === 'all' || type === 'folder') {
      const folders = await query<Folder[]>(
        'SELECT * FROM folders WHERE user_id = ? AND is_public = 1 ORDER BY updated_at DESC',
        [user.id]
      );

      result.folders = folders.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        publicUrl: f.public_url,
        shareUrl: `${APP_URL}/share/${f.public_url}`,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }));
    }

    return apiResponse(result, 200, 'Shared items retrieved successfully');

  } catch (error: any) {
    console.error('Get shared items error:', error);
    return apiError(error.message || 'Failed to get shared items', 500);
  }
}