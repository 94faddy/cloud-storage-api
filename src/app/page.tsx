'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Cloud, Zap, Shield, Code, ArrowRight, Upload, Folder, Key } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  // Parse max file size - 0 or empty means unlimited
  const maxFileSizeMB = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '0', 10);
  const isFileSizeUnlimited = maxFileSizeMB === 0 || isNaN(maxFileSizeMB);
  const maxStorageGB = process.env.NEXT_PUBLIC_MAX_STORAGE_GB || '50';

  // Format file size display
  const getMaxFileSizeDisplay = () => {
    if (isFileSizeUnlimited) {
      return '∞';
    }
    if (maxFileSizeMB >= 1024) {
      return `${(maxFileSizeMB / 1024).toFixed(0)}GB`;
    }
    return `${maxFileSizeMB}MB`;
  };

  const getMaxFileSizeLabel = () => {
    if (isFileSizeUnlimited) {
      return 'ไม่จำกัดขนาดไฟล์';
    }
    return 'ต่อไฟล์สูงสุด';
  };

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Cloud className="w-8 h-8 text-blue-500" />
              <span className="text-xl font-bold gradient-text">CloudVault</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-300 hover:text-white transition-colors">
                เข้าสู่ระบบ
              </Link>
              <Link href="/register" className="btn-primary">
                สมัครสมาชิก
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="animate-float mb-8">
            <Cloud className="w-24 h-24 mx-auto text-blue-500 animate-glow rounded-full" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="gradient-text">Cloud Storage</span>
            <br />
            <span className="text-white">ส่วนตัวของคุณ</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            จัดเก็บไฟล์อย่างปลอดภัย เชื่อมต่อผ่าน API ได้ง่าย
            ไม่ต้องพึ่งพาบริการภายนอก สร้างระบบเก็บข้อมูลของคุณเอง
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
              เริ่มต้นใช้งานฟรี <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#features" className="btn-secondary text-lg px-8 py-4">
              ดูฟีเจอร์ทั้งหมด
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            ฟีเจอร์ที่คุณต้องการ
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">
            ออกแบบมาสำหรับนักพัฒนาและผู้ใช้งานทั่วไปที่ต้องการความเป็นส่วนตัว
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="card hover:scale-105 transition-transform duration-300">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">อัพโหลดทุกประเภท</h3>
              <p className="text-gray-400">
                รองรับไฟล์และโฟลเดอร์ทุกประเภท อัพโหลดได้รวดเร็วและปลอดภัย
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card hover:scale-105 transition-transform duration-300">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                <Folder className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">จัดการโฟลเดอร์</h3>
              <p className="text-gray-400">
                สร้าง ย้าย ลบโฟลเดอร์ได้อิสระ จัดระเบียบไฟล์ตามต้องการ
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card hover:scale-105 transition-transform duration-300">
              <div className="w-12 h-12 rounded-lg bg-pink-500/20 flex items-center justify-center mb-4">
                <Key className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">API Keys</h3>
              <p className="text-gray-400">
                สร้าง API Keys หลายตัว กำหนดสิทธิ์แยกตามความต้องการ
              </p>
            </div>

            {/* Feature 4 */}
            <div className="card hover:scale-105 transition-transform duration-300">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                <Code className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">RESTful API</h3>
              <p className="text-gray-400">
                เชื่อมต่อจากแอพอื่นได้ง่าย พร้อมเอกสาร API ครบถ้วน
              </p>
            </div>

            {/* Feature 5 */}
            <div className="card hover:scale-105 transition-transform duration-300">
              <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">ปลอดภัยสูงสุด</h3>
              <p className="text-gray-400">
                เข้ารหัสข้อมูล JWT Authentication ปกป้องทุกการเข้าถึง
              </p>
            </div>

            {/* Feature 6 */}
            <div className="card hover:scale-105 transition-transform duration-300">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">รวดเร็วมาก</h3>
              <p className="text-gray-400">
                สร้างด้วย Next.js ประสิทธิภาพสูง ตอบสนองเร็วทันใจ
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="card">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold gradient-text mb-2">{maxStorageGB}GB</div>
                <div className="text-gray-400">พื้นที่ต่อผู้ใช้</div>
              </div>
              <div>
                <div className="text-4xl font-bold gradient-text mb-2">{getMaxFileSizeDisplay()}</div>
                <div className="text-gray-400">{getMaxFileSizeLabel()}</div>
              </div>
              <div>
                <div className="text-4xl font-bold gradient-text mb-2">∞</div>
                <div className="text-gray-400">ไม่จำกัด API Requests</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            พร้อมเริ่มต้นหรือยัง?
          </h2>
          <p className="text-gray-400 mb-8">
            สร้างบัญชีฟรีวันนี้ เริ่มจัดเก็บไฟล์และเชื่อมต่อ API ได้ทันที
          </p>
          <Link href="/register" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
            สมัครสมาชิกฟรี <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto text-center text-gray-500">
          <p>© 2026 CloudVault. </p>
        </div>
      </footer>
    </div>
  );
}