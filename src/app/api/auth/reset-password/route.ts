export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/utils';

interface ResetToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  used_at: Date | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token) {
      return apiError('Token ไม่ถูกต้อง', 400);
    }

    if (!password || password.length < 8) {
      return apiError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 400);
    }

    // Find reset token
    const tokens = await query<ResetToken[]>(
      'SELECT * FROM password_resets WHERE token = ?',
      [token]
    );

    if (!tokens[0]) {
      return apiError('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว', 400);
    }

    const resetToken = tokens[0];

    // Check if already used
    if (resetToken.used_at) {
      return apiError('ลิงก์นี้ถูกใช้งานไปแล้ว กรุณาขอลิงก์ใหม่', 400);
    }

    // Check if expired
    if (new Date(resetToken.expires_at) < new Date()) {
      return apiError('ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว กรุณาขอลิงก์ใหม่', 400);
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password
    await query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );

    // Mark token as used
    await query(
      'UPDATE password_resets SET used_at = NOW() WHERE id = ?',
      [resetToken.id]
    );

    return apiResponse(
      null,
      200,
      'เปลี่ยนรหัสผ่านสำเร็จ! คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว'
    );
  } catch (error: any) {
    console.error('Reset password error:', error);
    return apiError(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 500);
  }
}