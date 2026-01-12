'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cloud, Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      Swal.fire({
        icon: 'error',
        title: 'กรุณากรอกอีเมล',
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
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
      setLoading(false);
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
        <div className="card">
          {!sent ? (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">ลืมรหัสผ่าน?</h1>
              <p className="text-gray-400 text-center mb-8">
                กรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านให้
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">อีเมล</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      className="input pl-10"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      กำลังส่ง...
                    </>
                  ) : (
                    'ส่งลิงก์รีเซ็ตรหัสผ่าน'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">ตรวจสอบอีเมลของคุณ</h1>
              <p className="text-gray-400 mb-2">
                เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่
              </p>
              <p className="text-blue-400 font-medium mb-6">{email}</p>
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400">
                  ลิงก์จะหมดอายุใน 1 ชั่วโมง<br />
                  หากไม่พบอีเมล กรุณาตรวจสอบโฟลเดอร์สแปม
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}