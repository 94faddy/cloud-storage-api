export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/utils';

interface UserWithPassword {
  id: number;
  email: string;
  username: string;
  password: string;
  storage_used: number;
  storage_limit: number;
  is_admin: boolean;
  email_verified: boolean;
  created_at: Date;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return apiError('กรุณากรอกอีเมลและรหัสผ่าน', 400);
    }

    // Find user
    const users = await query<UserWithPassword[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return apiError('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401);
    }

    const user = users[0];

    // Verify password
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return apiError('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401);
    }

    // Check email verification (if enabled)
    const emailVerificationEnabled = process.env.EMAIL_VERIFICATION_ENABLED === 'true';
    
    if (emailVerificationEnabled && !user.email_verified) {
      return apiError(
        'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ ตรวจสอบกล่องจดหมายของคุณ',
        403,
        { requiresVerification: true, email: user.email }
      );
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Create response with cookie
    const response = apiResponse(
      { user: userWithoutPassword, token },
      200,
      'เข้าสู่ระบบสำเร็จ'
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
    console.error('Login error:', error);
    return apiError(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 500);
  }
}