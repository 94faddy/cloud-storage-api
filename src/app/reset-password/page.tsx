'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Cloud, Lock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านไม่ตรงกัน',
        text: 'กรุณากรอกรหัสผ่านให้ตรงกัน',
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    if (formData.password.length < 8) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านสั้นเกินไป',
        text: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
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

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <Cloud className="w-10 h-10 text-blue-500" />
              <span className="text-2xl font-bold gradient-text">CloudVault</span>
            </Link>
          </div>

          <div className="card text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">ลิงก์ไม่ถูกต้อง</h1>
            <p className="text-gray-400 mb-6">
              ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว
            </p>
            <Link href="/forgot-password" className="btn-primary py-3 px-6 inline-block">
              ขอลิงก์ใหม่
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          {!success ? (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">ตั้งรหัสผ่านใหม่</h1>
              <p className="text-gray-400 text-center mb-8">
                กรุณากรอกรหัสผ่านใหม่ของคุณ
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">รหัสผ่านใหม่</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      className="input pl-10"
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ยืนยันรหัสผ่านใหม่</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      className="input pl-10"
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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
                      กำลังบันทึก...
                    </>
                  ) : (
                    'เปลี่ยนรหัสผ่าน'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">เปลี่ยนรหัสผ่านสำเร็จ! 🎉</h1>
              <p className="text-gray-400 mb-6">
                กำลังพาคุณไปหน้าเข้าสู่ระบบ...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}