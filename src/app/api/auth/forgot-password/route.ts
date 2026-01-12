export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/utils';
import { User } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return apiError('กรุณากรอกอีเมล', 400);
    }

    // Find user
    const users = await query<User[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    // Always return success (don't reveal if email exists)
    if (!users[0]) {
      return apiResponse(
        null,
        200,
        'หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล'
      );
    }

    const user = users[0];

    // Import email function
    const { sendPasswordResetEmail } = await import('@/lib/email');

    // Create reset token
    const resetToken = uuidv4() + '-' + uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Delete old tokens for this user
    await query(
      'DELETE FROM password_resets WHERE user_id = ?',
      [user.id]
    );

    // Save new token
    await query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, expiresAt]
    );

    // Send email
    await sendPasswordResetEmail(email, user.username, resetToken);

    return apiResponse(
      null,
      200,
      'หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล'
    );
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return apiError(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 500);
  }
}