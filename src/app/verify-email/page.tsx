'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Cloud, CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('ไม่พบ token สำหรับยืนยันอีเมล');
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await res.json();

        if (data.success) {
          setStatus('success');
          setMessage('ยืนยันอีเมลสำเร็จ!');
          
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          setStatus('error');
          setMessage(data.error || 'การยืนยันล้มเหลว');
        }
      } catch (error) {
        setStatus('error');
        setMessage('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Cloud className="w-10 h-10 text-blue-500" />
            <span className="text-2xl font-bold gradient-text">CloudVault</span>
          </Link>
        </div>

        {/* Card */}
        <div className="card text-center">
          {status === 'loading' && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">กำลังยืนยันอีเมล...</h1>
              <p className="text-gray-400">กรุณารอสักครู่</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">ยืนยันอีเมลสำเร็จ! 🎉</h1>
              <p className="text-gray-400 mb-6">{message}</p>
              <p className="text-sm text-gray-500">กำลังพาคุณไปยัง Dashboard...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">ยืนยันอีเมลไม่สำเร็จ</h1>
              <p className="text-gray-400 mb-6">{message}</p>
              
              <div className="space-y-3">
                <Link href="/login" className="block w-full btn-primary py-3">
                  <Mail className="w-5 h-5 inline mr-2" />
                  ไปหน้าเข้าสู่ระบบ
                </Link>
                <Link href="/register" className="block w-full btn-secondary py-3">
                  สมัครสมาชิกใหม่
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}