export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/utils';
import { User } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password } = body;

    // Validation
    if (!email || !username || !password) {
      return apiError('กรุณากรอกข้อมูลให้ครบถ้วน', 400);
    }

    if (password.length < 8) {
      return apiError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 400);
    }

    // Check if email exists
    const existingEmail = await query<User[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return apiError('อีเมลนี้ถูกใช้งานแล้ว', 400);
    }

    // Check if username exists
    const existingUsername = await query<User[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsername.length > 0) {
      return apiError('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Check if this is the first admin
    const isAdmin = email === process.env.ADMIN_EMAIL;

    // Get default storage limit (convert GB to bytes)
    const maxStorageGB = parseFloat(process.env.NEXT_PUBLIC_MAX_STORAGE_GB || '50');
    const storageLimit = Math.floor(maxStorageGB * 1024 * 1024 * 1024);

    // Check if email verification is enabled
    const emailVerificationEnabled = process.env.EMAIL_VERIFICATION_ENABLED === 'true';

    // Create user
    const result = await query<any>(
      `INSERT INTO users (email, username, password, is_admin, storage_limit, email_verified) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, username, hashedPassword, isAdmin, storageLimit, !emailVerificationEnabled]
    );

    const userId = result.insertId;

    // If email verification is enabled, send verification email
    if (emailVerificationEnabled) {
      try {
        const { sendVerificationEmail } = await import('@/lib/email');
        
        // Create verification token
        const verificationToken = uuidv4() + '-' + uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.VERIFICATION_TOKEN_EXPIRES_HOURS || '24'));

        // Save token to database
        await query(
          'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
          [userId, verificationToken, expiresAt]
        );

        // Send email
        await sendVerificationEmail(email, username, verificationToken);

        return apiResponse(
          { requiresVerification: true, email },
          201,
          'สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี'
        );
      } catch (emailError: any) {
        console.error('Failed to send verification email:', emailError);
        // User created but email failed - still return success but with warning
        return apiResponse(
          { requiresVerification: true, email, emailError: true },
          201,
          'สมัครสมาชิกสำเร็จ แต่ไม่สามารถส่งอีเมลยืนยันได้ กรุณาขอส่งใหม่'
        );
      }
    }

    // Email verification disabled - auto login
    const users = await query<User[]>(
      'SELECT id, email, username, storage_used, storage_limit, is_admin, email_verified, created_at FROM users WHERE id = ?',
      [userId]
    );

    const user = users[0];

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    });

    // Create response with cookie
    const response = apiResponse(
      { user, token, requiresVerification: false },
      201,
      'สมัครสมาชิกสำเร็จ!'
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Register error:', error);
    return apiError(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 500);
  }
}