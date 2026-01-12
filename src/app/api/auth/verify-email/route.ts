export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/utils';
import { User } from '@/types';

interface VerificationToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  used_at: Date | null;
}

// GET - Verify email with token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return apiError('Verification token is required', 400);
    }

    // Find verification token
    const tokens = await query<VerificationToken[]>(
      'SELECT * FROM email_verifications WHERE token = ?',
      [token]
    );

    if (!tokens[0]) {
      return apiError('Invalid verification token', 400);
    }

    const verification = tokens[0];

    // Check if already used
    if (verification.used_at) {
      return apiError('This verification link has already been used', 400);
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      return apiError('Verification link has expired. Please request a new one.', 400);
    }

    // Update user as verified
    await query(
      'UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE id = ?',
      [verification.user_id]
    );

    // Mark token as used
    await query(
      'UPDATE email_verifications SET used_at = NOW() WHERE id = ?',
      [verification.id]
    );

    // Get user
    const users = await query<User[]>(
      'SELECT id, email, username, storage_used, storage_limit, is_admin, email_verified, created_at FROM users WHERE id = ?',
      [verification.user_id]
    );

    const user = users[0];

    // Generate auth token
    const authToken = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    });

    // Set cookie and return
    const response = apiResponse(
      { user, token: authToken, verified: true },
      200,
      'Email verified successfully!'
    );

    response.cookies.set('auth_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Verify email error:', error);
    return apiError(error.message || 'Verification failed', 500);
  }
}

// POST - Resend verification email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return apiError('Email is required', 400);
    }

    // Find user
    const users = await query<User[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!users[0]) {
      // Don't reveal if email exists
      return apiResponse(
        null,
        200,
        'If your email is registered, you will receive a verification link.'
      );
    }

    const user = users[0];

    // Check if already verified
    if ((user as any).email_verified) {
      return apiError('Email is already verified', 400);
    }

    // Import here to avoid circular dependency
    const { sendVerificationEmail } = await import('@/lib/email');
    const { v4: uuidv4 } = await import('uuid');

    // Create new verification token
    const verificationToken = uuidv4() + '-' + uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.VERIFICATION_TOKEN_EXPIRES_HOURS || '24'));

    // Invalidate old tokens
    await query(
      'DELETE FROM email_verifications WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    // Save new token
    await query(
      'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, verificationToken, expiresAt]
    );

    // Send email
    await sendVerificationEmail(email, user.username, verificationToken);

    return apiResponse(
      null,
      200,
      'Verification email has been sent. Please check your inbox.'
    );
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return apiError(error.message || 'Failed to resend verification email', 500);
  }
}