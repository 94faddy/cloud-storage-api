export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getUserFromRequest, hashPassword, verifyPassword } from '@/lib/auth';
import { apiResponse, apiError, validatePassword } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return apiError('กรุณาเข้าสู่ระบบ', 401);
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return apiError('กรุณากรอกข้อมูลให้ครบ', 400);
    }

    if (!validatePassword(newPassword)) {
      return apiError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', 400);
    }

    // Get current password hash
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT password FROM users WHERE id = ?',
      [user.id]
    );

    if (users.length === 0) {
      return apiError('ไม่พบผู้ใช้', 404);
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, users[0].password);
    if (!isValid) {
      return apiError('รหัสผ่านปัจจุบันไม่ถูกต้อง', 400);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [newPasswordHash, user.id]
    );

    return apiResponse(null, 200, 'เปลี่ยนรหัสผ่านสำเร็จ');

  } catch (error: any) {
    console.error('Password change error:', error);
    return apiError('เกิดข้อผิดพลาด', 500);
  }
}