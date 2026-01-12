export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/utils';
import { verifyToken } from '@/lib/auth';
import { testSMTPConnection, sendTestEmail } from '@/lib/email';

// GET - Test SMTP connection
export async function GET(request: NextRequest) {
  try {
    // Check admin auth
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return apiError('Unauthorized', 401);
    }

    const decoded = verifyToken(token);
    
    if (!decoded || !decoded.isAdmin) {
      return apiError('Admin access required', 403);
    }

    // Test SMTP connection
    const result = await testSMTPConnection();

    return apiResponse(
      {
        connected: result.success,
        message: result.message,
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: process.env.SMTP_SECURE,
          user: process.env.SMTP_USER,
          from: process.env.SMTP_FROM,
        }
      },
      200,
      result.success ? 'SMTP connection successful' : 'SMTP connection failed'
    );
  } catch (error: any) {
    console.error('Test SMTP error:', error);
    return apiError(error.message || 'Failed to test SMTP', 500);
  }
}

// POST - Send test email
export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return apiError('Unauthorized', 401);
    }

    const decoded = verifyToken(token);
    
    if (!decoded || !decoded.isAdmin) {
      return apiError('Admin access required', 403);
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return apiError('Email is required', 400);
    }

    // Send test email
    await sendTestEmail(email);

    return apiResponse(
      { sent: true, to: email },
      200,
      `Test email sent to ${email}`
    );
  } catch (error: any) {
    console.error('Send test email error:', error);
    return apiError(error.message || 'Failed to send test email', 500);
  }
}