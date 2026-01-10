import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/utils';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(apiError('กรุณาเข้าสู่ระบบ'), { status: 401 });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Delete all API keys
      await connection.execute('DELETE FROM api_keys WHERE user_id = ?', [user.id]);

      // Delete all activity logs
      await connection.execute('DELETE FROM activity_logs WHERE user_id = ?', [user.id]);

      // Delete all files from database
      await connection.execute('DELETE FROM files WHERE user_id = ?', [user.id]);

      // Delete all folders
      await connection.execute('DELETE FROM folders WHERE user_id = ?', [user.id]);

      // Delete user
      await connection.execute('DELETE FROM users WHERE id = ?', [user.id]);

      await connection.commit();

      // Delete user's upload folder
      const userUploadPath = path.join(process.cwd(), 'uploads', `user_${user.id}`);
      try {
        await fs.rm(userUploadPath, { recursive: true, force: true });
      } catch (fsError) {
        console.log('User folder may not exist:', fsError);
      }

      // Clear auth cookie
      const response = NextResponse.json(apiResponse(null, 'ลบบัญชีสำเร็จ'));
      response.cookies.delete('auth_token');

      return response;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error: any) {
    console.error('Account delete error:', error);
    return NextResponse.json(apiError('เกิดข้อผิดพลาด'), { status: 500 });
  }
}
