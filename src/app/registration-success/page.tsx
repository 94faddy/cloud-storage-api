'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Cloud, Mail, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

function RegistrationSuccessContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่พบอีเมล',
        text: 'กรุณาลองสมัครสมาชิกใหม่',
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    setResending(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        setResent(true);
        Swal.fire({
          icon: 'success',
          title: 'ส่งอีเมลใหม่แล้ว!',
          text: 'กรุณาตรวจสอบกล่องจดหมายของคุณ',
          background: '#1e293b',
          color: '#fff',
          confirmButtonColor: '#6366f1',
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ส่งอีเมลไม่สำเร็จ',
          text: data.error || 'กรุณาลองใหม่อีกครั้ง',
          background: '#1e293b',
          color: '#fff',
          confirmButtonColor: '#6366f1',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1',
      });
    } finally {
      setResending(false);
    }
  };

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
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Mail className="w-10 h-10 text-blue-500" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">ตรวจสอบอีเมลของคุณ 📬</h1>
          
          <p className="text-gray-400 mb-2">
            เราได้ส่งลิงก์ยืนยันไปที่
          </p>
          
          <p className="text-blue-400 font-medium mb-6 break-all">
            {email || 'อีเมลของคุณ'}
          </p>

          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400">
              คลิกลิงก์ในอีเมลเพื่อยืนยันบัญชีของคุณ<br />
              ลิงก์จะหมดอายุใน 24 ชั่วโมง
            </p>
          </div>

          {/* Resend Button */}
          <button
            onClick={handleResend}
            disabled={resending || resent}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              resent 
                ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            {resending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                กำลังส่ง...
              </>
            ) : resent ? (
              <>
                <CheckCircle className="w-5 h-5" />
                ส่งอีเมลใหม่แล้ว
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                ส่งอีเมลอีกครั้ง
              </>
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-sm text-gray-500 mb-3">
              ไม่พบอีเมล? ตรวจสอบโฟลเดอร์สแปม
            </p>
            <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm">
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    }>
      <RegistrationSuccessContent />
    </Suspense>
  );
}