import { NextRequest, NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { apiResponse, apiError, isValidEmail, isValidPassword } from '@/lib/utils';
import { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Initialize database on first request
    await initDatabase();

    const body = await request.json();
    const { email, username, password } = body;

    // Validation
    if (!email || !username || !password) {
      return apiError('Email, username and password are required', 400);
    }

    if (!isValidEmail(email)) {
      return apiError('Invalid email format', 400);
    }

    if (!isValidPassword(password)) {
      return apiError('Password must be at least 8 characters', 400);
    }

    if (username.length < 3) {
      return apiError('Username must be at least 3 characters', 400);
    }

    // Check if user exists
    const existingUsers = await query<User[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return apiError('Email already registered', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Check if this is the admin email
    const isAdmin = email === process.env.ADMIN_EMAIL;

    // Calculate storage limit
    const storageLimit = parseInt(process.env.NEXT_PUBLIC_MAX_STORAGE_GB || '50') * 1024 * 1024 * 1024;

    // Create user
    const result = await query<any>(
      `INSERT INTO users (email, username, password, storage_limit, is_admin) VALUES (?, ?, ?, ?, ?)`,
      [email, username, hashedPassword, storageLimit, isAdmin]
    );

    // Get created user
    const users = await query<User[]>(
      'SELECT id, email, username, storage_used, storage_limit, is_admin, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = users[0];

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    });

    // Set cookie
    const response = apiResponse(
      { user, token },
      201,
      'Registration successful'
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
    return apiError(error.message || 'Registration failed', 500);
  }
}