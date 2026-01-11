export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils';
import { ApiKey } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Get keys with full key value
    const keys = await query<ApiKey[]>(
      `SELECT id, user_id, name, api_key,
              permissions, is_active, last_used_at, created_at, expires_at 
       FROM api_keys 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [user.id]
    );

    return apiResponse(keys);
  } catch (error: any) {
    console.error('List API keys error:', error);
    return apiError(error.message || 'Failed to list API keys', 500);
  }
}