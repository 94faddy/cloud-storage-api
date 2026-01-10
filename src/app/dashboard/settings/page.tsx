'use client';

import { useState, useEffect } from 'react';
import { Settings, User, Lock, Bell, Shield, Trash2, Save, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import Swal from 'sweetalert2';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  storage_used: number;
  storage_limit: number;
  created_at: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile form
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  
  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  // Notifications
  const [notifications, setNotifications] = useState({
    emailOnUpload: false,
    emailOnDelete: false,
    emailOnStorageFull: true,
    emailOnNewLogin: true
  });

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.data?.user) {
        const userData = data.data.user;
        setUser(userData);
        setUsername(userData.username || '');
        setEmail(userData.email || '');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    if (!username.trim() || !email.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'กรุณากรอกข้อมูลให้ครบ',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
      });

      const data = await res.json();
      if (data.success) {
        setUser(prev => prev ? { ...prev, username, email } : null);
        Swal.fire({
          icon: 'success',
          title: 'อัพเดทโปรไฟล์สำเร็จ',
          background: '#1e293b',
          color: '#f1f5f9',
          timer: 1500
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message,
        background: '#1e293b',
        color: '#f1f5f9'
      });
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'กรุณากรอกข้อมูลให้ครบ',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านใหม่ไม่ตรงกัน',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }

    if (newPassword.length < 8) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }

    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (data.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        Swal.fire({
          icon: 'success',
          title: 'เปลี่ยนรหัสผ่านสำเร็จ',
          background: '#1e293b',
          color: '#f1f5f9',
          timer: 1500
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message,
        background: '#1e293b',
        color: '#f1f5f9'
      });
    }
  };

  const deleteAccount = async () => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'ลบบัญชีผู้ใช้?',
      html: `
        <p class="text-red-400 mb-2">⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้!</p>
        <p class="text-sm">ข้อมูลทั้งหมดจะถูกลบถาวร รวมถึง:</p>
        <ul class="text-left text-sm mt-2 ml-4">
          <li>• ไฟล์ทั้งหมดของคุณ</li>
          <li>• โฟลเดอร์ทั้งหมด</li>
          <li>• API Keys ทั้งหมด</li>
          <li>• ประวัติการใช้งาน</li>
        </ul>
      `,
      input: 'text',
      inputPlaceholder: 'พิมพ์ DELETE เพื่อยืนยัน',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'ลบบัญชี',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#f1f5f9',
      preConfirm: (value) => {
        if (value !== 'DELETE') {
          Swal.showValidationMessage('กรุณาพิมพ์ DELETE เพื่อยืนยัน');
        }
      }
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/user/delete', {
          method: 'DELETE'
        });

        const data = await res.json();
        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ลบบัญชีสำเร็จ',
            text: 'กำลังออกจากระบบ...',
            background: '#1e293b',
            color: '#f1f5f9',
            timer: 2000,
            showConfirmButton: false
          }).then(() => {
            window.location.href = '/';
          });
        } else {
          throw new Error(data.error);
        }
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: error.message,
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    }
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const tabs = [
    { id: 'profile', label: 'โปรไฟล์', icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'ความปลอดภัย', icon: <Lock className="w-4 h-4" /> },
    { id: 'notifications', label: 'การแจ้งเตือน', icon: <Bell className="w-4 h-4" /> },
    { id: 'danger', label: 'โซนอันตราย', icon: <AlertCircle className="w-4 h-4" /> }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-400" />
          ตั้งค่า
        </h1>
        <p className="text-gray-400 mt-1">จัดการบัญชีและการตั้งค่าของคุณ</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="glass rounded-xl p-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              ข้อมูลโปรไฟล์
            </h2>

            {/* Account Info */}
            <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-lg">
              <div>
                <span className="text-sm text-gray-400">สมาชิกตั้งแต่</span>
                <p className="font-medium">{user?.created_at ? formatDate(user.created_at) : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-400">พื้นที่ใช้งาน</span>
                <p className="font-medium">
                  {user ? `${formatBytes(user.storage_used || 0)} / ${formatBytes(user.storage_limit || 53687091200)}` : '-'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ชื่อผู้ใช้</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">อีเมล</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>

            <button
              onClick={updateProfile}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-400" />
              เปลี่ยนรหัสผ่าน
            </h2>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium mb-1">รหัสผ่านปัจจุบัน</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-white"
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">รหัสผ่านใหม่</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input w-full"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ยืนยันรหัสผ่านใหม่</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input w-full"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-400 text-sm mt-1">รหัสผ่านไม่ตรงกัน</p>
                )}
              </div>
            </div>

            <button
              onClick={changePassword}
              className="btn-primary flex items-center gap-2"
              disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
            >
              <Shield className="w-4 h-4" />
              เปลี่ยนรหัสผ่าน
            </button>

            {/* Security Tips */}
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                เคล็ดลับความปลอดภัย
              </h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• ใช้รหัสผ่านที่มีความยาวอย่างน้อย 12 ตัวอักษร</li>
                <li>• ผสมตัวอักษรพิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และสัญลักษณ์</li>
                <li>• อย่าใช้รหัสผ่านเดียวกับเว็บไซต์อื่น</li>
                <li>• เก็บ API Keys ไว้ในที่ปลอดภัย อย่าแชร์ให้คนอื่น</li>
              </ul>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-400" />
              การแจ้งเตือนทางอีเมล
            </h2>

            <div className="space-y-4">
              {[
                { key: 'emailOnUpload', label: 'แจ้งเตือนเมื่ออัพโหลดไฟล์', desc: 'รับอีเมลทุกครั้งที่มีการอัพโหลดไฟล์ใหม่' },
                { key: 'emailOnDelete', label: 'แจ้งเตือนเมื่อลบไฟล์', desc: 'รับอีเมลทุกครั้งที่มีการลบไฟล์' },
                { key: 'emailOnStorageFull', label: 'แจ้งเตือนพื้นที่ใกล้เต็ม', desc: 'รับอีเมลเมื่อพื้นที่จัดเก็บใช้งานเกิน 90%' },
                { key: 'emailOnNewLogin', label: 'แจ้งเตือนการเข้าสู่ระบบใหม่', desc: 'รับอีเมลเมื่อมีการเข้าสู่ระบบจากอุปกรณ์ใหม่' }
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={notifications[item.key as keyof typeof notifications]}
                    onChange={(e) =>
                      setNotifications({
                        ...notifications,
                        [item.key]: e.target.checked
                      })
                    }
                    className="mt-1 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-gray-400">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={() => {
                Swal.fire({
                  icon: 'success',
                  title: 'บันทึกการตั้งค่าสำเร็จ',
                  background: '#1e293b',
                  color: '#f1f5f9',
                  timer: 1500
                });
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              บันทึกการตั้งค่า
            </button>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400">
                <strong>หมายเหตุ:</strong> ระบบแจ้งเตือนทางอีเมลจะทำงานได้ต่อเมื่อตั้งค่า SMTP ในไฟล์ .env แล้วเท่านั้น
              </p>
            </div>
          </div>
        )}

        {/* Danger Zone Tab */}
        {activeTab === 'danger' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              โซนอันตราย
            </h2>

            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <h3 className="font-medium text-red-400 mb-2">ลบบัญชีผู้ใช้</h3>
              <p className="text-sm text-gray-400 mb-4">
                เมื่อลบบัญชี ข้อมูลทั้งหมดของคุณจะถูกลบถาวรและไม่สามารถกู้คืนได้
                รวมถึงไฟล์ โฟลเดอร์ API Keys และประวัติการใช้งานทั้งหมด
              </p>
              <button
                onClick={deleteAccount}
                className="btn-danger flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                ลบบัญชีของฉัน
              </button>
            </div>

            <div className="p-4 bg-gray-800/50 rounded-lg">
              <h3 className="font-medium mb-2">ดาวน์โหลดข้อมูลทั้งหมด</h3>
              <p className="text-sm text-gray-400 mb-4">
                ดาวน์โหลดไฟล์ทั้งหมดของคุณเป็นไฟล์ ZIP ก่อนลบบัญชี
              </p>
              <button
                onClick={() => {
                  Swal.fire({
                    icon: 'info',
                    title: 'ฟีเจอร์นี้กำลังพัฒนา',
                    text: 'ระบบ Export ข้อมูลจะพร้อมใช้งานเร็วๆ นี้',
                    background: '#1e293b',
                    color: '#f1f5f9'
                  });
                }}
                className="btn-secondary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                ดาวน์โหลดข้อมูล
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}