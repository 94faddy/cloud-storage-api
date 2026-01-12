'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Cloud, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        // Check if email verification is required
        if (data.data?.requiresVerification) {
          Swal.fire({
            icon: 'warning',
            title: 'กรุณายืนยันอีเมล',
            text: 'คุณยังไม่ได้ยืนยันอีเมล ตรวจสอบกล่องจดหมายของคุณ',
            showCancelButton: true,
            confirmButtonText: 'ส่งอีเมลยืนยันอีกครั้ง',
            cancelButtonText: 'ปิด',
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#6366f1',
          }).then(async (result) => {
            if (result.isConfirmed) {
              // Resend verification email
              const resendRes = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email }),
              });
              const resendData = await resendRes.json();
              
              Swal.fire({
                icon: resendData.success ? 'success' : 'error',
                title: resendData.success ? 'ส่งอีเมลแล้ว!' : 'เกิดข้อผิดพลาด',
                text: resendData.message || resendData.error,
                background: '#1e293b',
                color: '#fff',
                confirmButtonColor: '#6366f1',
              });
            }
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'เข้าสู่ระบบไม่สำเร็จ',
            text: data.error || 'กรุณาตรวจสอบอีเมลและรหัสผ่าน',
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#6366f1',
          });
        }
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

        {/* Login Card */}
        <div className="card">
          <h1 className="text-2xl font-bold text-white text-center mb-2">ยินดีต้อนรับกลับ</h1>
          <p className="text-gray-400 text-center mb-8">เข้าสู่ระบบเพื่อจัดการไฟล์ของคุณ</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">อีเมล</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  className="input pl-10"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">รหัสผ่าน</label>
                <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  className="input pl-10"
                  placeholder="รหัสผ่านของคุณ"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  เข้าสู่ระบบ
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              ยังไม่มีบัญชี?{' '}
              <Link href="/register" className="text-blue-400 hover:text-indigo-300">
                สมัครสมาชิก
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}