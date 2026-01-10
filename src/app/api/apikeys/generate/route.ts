import { NextRequest } from 'next/server';
import { getUserFromRequest, generateApiKey, logActivity } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { ApiKey, ApiKeyPermissions } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { name, permissions, expiresIn } = body;

    if (!name) {
      return apiError('API key name is required', 400);
    }

    // Default permissions
    const defaultPermissions: ApiKeyPermissions = {
      upload: true,
      download: true,
      delete: false,
      list: true,
      createFolder: false,
      deleteFolder: false,
    };

    const keyPermissions: ApiKeyPermissions = {
      ...defaultPermissions,
      ...(permissions || {}),
    };

    // Generate unique key
    const apiKey = generateApiKey();
    const keyPrefix = apiKey.substring(0, 12); // cv_xxxxxxxx

    // Calculate expiry date
    let expiresAt: Date | null = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
    }

    // Insert into database - store full key
    const result = await query<any>(
      `INSERT INTO api_keys (user_id, name, api_key, key_prefix, permissions, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, name, apiKey, keyPrefix, JSON.stringify(keyPermissions), expiresAt]
    );

    // Get created key
    const keys = await query<ApiKey[]>(
      'SELECT id, user_id, name, api_key, permissions, is_active, last_used_at, created_at, expires_at FROM api_keys WHERE id = ?',
      [result.insertId]
    );

    // Log activity
    await logActivity(
      user.id,
      'create_api_key',
      { name },
      getClientIp(request),
      getUserAgent(request)
    );

    // Return with full key
    return apiResponse(
      keys[0],
      201,
      'API key created successfully. Make sure to save the key!'
    );
  } catch (error: any) {
    console.error('Generate API key error:', error);
    return apiError(error.message || 'Failed to generate API key', 500);
  }
}