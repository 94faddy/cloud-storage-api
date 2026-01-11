export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { apiResponse } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const response = apiResponse(null, 200, 'Logged out successfully');
  
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
