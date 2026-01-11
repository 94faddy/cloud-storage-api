export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { apiResponse, apiError, validateEmail } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return apiError('กรุณาเข้าสู่ระบบ', 401);
    }

    const { username, email } = await request.json();

    if (!username?.trim() || !email?.trim()) {
      return apiError('กรุณากรอกข้อมูลให้ครบ', 400);
    }

    if (!validateEmail(email)) {
      return apiError('รูปแบบอีเมลไม่ถูกต้อง', 400);
    }

    // Check if email already exists (for other users)
    const [existingUsers] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, user.id]
    );

    if (existingUsers.length > 0) {
      return apiError('อีเมลนี้ถูกใช้งานแล้ว', 400);
    }

    // Check if username already exists (for other users)
    const [existingUsernames] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, user.id]
    );

    if (existingUsernames.length > 0) {
      return apiError('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว', 400);
    }

    // Update profile
    await pool.execute(
      'UPDATE users SET username = ?, email = ? WHERE id = ?',
      [username.trim(), email.trim().toLowerCase(), user.id]
    );

    return apiResponse({ username, email }, 200, 'อัพเดทโปรไฟล์สำเร็จ');

  } catch (error: any) {
    console.error('Profile update error:', error);
    return apiError('เกิดข้อผิดพลาด', 500);
  }
}