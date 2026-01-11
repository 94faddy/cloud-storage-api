export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest, logActivity } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/utils';
import { ApiKey } from '@/types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const keyId = parseInt(params.id);
    if (isNaN(keyId)) {
      return apiError('Invalid API key ID', 400);
    }

    // Verify ownership
    const keys = await query<ApiKey[]>(
      'SELECT * FROM api_keys WHERE id = ? AND user_id = ?',
      [keyId, user.id]
    );

    if (!keys[0]) {
      return apiError('API key not found', 404);
    }

    // Delete key
    await query('DELETE FROM api_keys WHERE id = ?', [keyId]);

    // Log activity
    await logActivity(
      user.id,
      'revoke_api_key',
      { name: keys[0].name },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(null, 200, 'API key revoked successfully');
  } catch (error: any) {
    console.error('Revoke API key error:', error);
    return apiError(error.message || 'Failed to revoke API key', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const keyId = parseInt(params.id);
    if (isNaN(keyId)) {
      return apiError('Invalid API key ID', 400);
    }

    const body = await request.json();
    // Support both is_active and isActive
    const isActiveValue = body.isActive !== undefined ? body.isActive : body.is_active;
    const isActive = isActiveValue !== undefined ? Boolean(isActiveValue) : undefined;

    if (isActive === undefined) {
      return apiError('isActive or is_active is required', 400);
    }

    // Verify ownership
    const keys = await query<ApiKey[]>(
      'SELECT * FROM api_keys WHERE id = ? AND user_id = ?',
      [keyId, user.id]
    );

    if (!keys[0]) {
      return apiError('API key not found', 404);
    }

    // Update key
    await query('UPDATE api_keys SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, keyId]);

    // Log activity
    await logActivity(
      user.id,
      isActive ? 'activate_api_key' : 'deactivate_api_key',
      { name: keys[0].name },
      getClientIp(request),
      getUserAgent(request)
    );

    return apiResponse(null, 200, `API key ${isActive ? 'activated' : 'deactivated'} successfully`);
  } catch (error: any) {
    console.error('Update API key error:', error);
    return apiError(error.message || 'Failed to update API key', 500);
  }
}