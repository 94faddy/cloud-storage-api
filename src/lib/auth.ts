import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from './db';
import { User, JWTPayload, ApiKey, ApiKeyPermissions } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JWTPayload): string {
  // Convert expiry string to seconds
  const parseExpiry = (expiry: string): number => {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // default 7 days
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 7 * 24 * 60 * 60;
    }
  };

  const expiresInSeconds = parseExpiry(JWT_EXPIRES_IN);
  
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    const users = await query<User[]>(
      'SELECT id, email, username, storage_used, storage_limit, is_admin, created_at, updated_at FROM users WHERE id = ?',
      [payload.userId]
    );

    return users[0] || null;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(request: Request): Promise<User | null> {
  // Try cookie first
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
    if (tokenMatch) {
      const payload = verifyToken(tokenMatch[1]);
      if (payload) {
        const users = await query<User[]>(
          'SELECT id, email, username, storage_used, storage_limit, is_admin, created_at, updated_at FROM users WHERE id = ?',
          [payload.userId]
        );
        return users[0] || null;
      }
    }
  }

  // Try Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      const users = await query<User[]>(
        'SELECT id, email, username, storage_used, storage_limit, is_admin, created_at, updated_at FROM users WHERE id = ?',
        [payload.userId]
      );
      return users[0] || null;
    }
  }

  return null;
}

export async function validateApiKey(request: Request): Promise<{ user: User; apiKey: ApiKey; permissions: ApiKeyPermissions } | null> {
  const apiKeyHeader = request.headers.get('x-api-key');
  
  if (!apiKeyHeader) return null;

  // Find API key directly
  const apiKeys = await query<any[]>(
    `SELECT ak.*, u.id as uid, u.email, u.username, u.storage_used, u.storage_limit, u.is_admin
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.api_key = ? AND ak.is_active = 1 AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
    [apiKeyHeader]
  );

  if (!apiKeys[0]) return null;

  const apiKey = apiKeys[0];
  
  // Update last used AND increment request_count
  await query(
    'UPDATE api_keys SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = ?', 
    [apiKey.id]
  );

  const user: User = {
    id: apiKey.uid,
    email: apiKey.email,
    username: apiKey.username,
    storage_used: apiKey.storage_used,
    storage_limit: apiKey.storage_limit,
    is_admin: apiKey.is_admin,
    created_at: apiKey.created_at,
    updated_at: apiKey.updated_at,
  };

  const permissions: ApiKeyPermissions = typeof apiKey.permissions === 'string' 
    ? JSON.parse(apiKey.permissions) 
    : apiKey.permissions;

  return { user, apiKey, permissions };
}

export async function logActivity(
  userId: number,
  action: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, action, details ? JSON.stringify(details) : null, ipAddress || null, userAgent || null]
    );
  } catch (error) {
    console.error('Log activity error:', error);
  }
}

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'cv_';
  let key = prefix;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
