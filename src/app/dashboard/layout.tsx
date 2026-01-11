'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Cloud, LayoutDashboard, FolderOpen, Key, Book,
  Settings, LogOut, Menu, X, ChevronRight, HardDrive, RefreshCw
} from 'lucide-react';
import Swal from 'sweetalert2';

interface User {
  id: number;
  email: string;
  username: string;
  storage_used: number;
  storage_limit: number;
  is_admin: boolean;
}

interface StorageStats {
  used: number;
  limit: number;
  percentage: number;
  files_count: number;
  folders_count: number;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (data.success) {
        setUser(data.data.user);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      if (showRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        
        if (data.success) {
          setUser(data.data.user);
          setStats(data.data.stats);
        } else {
          router.push('/login');
        }
      } catch (error) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  // Polling for realtime updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [fetchStats]);

  // Listen for custom storage update events
  useEffect(() => {
    const handleStorageUpdate = () => {
      fetchStats(true);
    };

    // Listen for custom event when files are uploaded/deleted
    window.addEventListener('storage-updated', handleStorageUpdate);
    
    // Also listen for focus to refresh when user comes back to tab
    const handleFocus = () => {
      fetchStats();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage-updated', handleStorageUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchStats]);

  // Refresh when pathname changes (navigating between pages)
  useEffect(() => {
    fetchStats();
  }, [pathname, fetchStats]);

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'ออกจากระบบ?',
      text: 'คุณต้องการออกจากระบบหรือไม่?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
    });

    if (result.isConfirmed) {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    }
  };

  const handleManualRefresh = () => {
    fetchStats(true);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'แดชบอร์ด' },
    { href: '/dashboard/files', icon: FolderOpen, label: 'ไฟล์ของฉัน' },
    { href: '/dashboard/apikeys', icon: Key, label: 'จัดการ API Keys' },
    { href: '/dashboard/docs', icon: Book, label: 'เอกสาร API' },
    { href: '/dashboard/settings', icon: Settings, label: 'ตั้งค่า' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Mobile Menu Button */}
      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-lg glass md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
      </button>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-700/50">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Cloud className="w-8 h-8 text-blue-500" />
            <span className="text-xl font-bold gradient-text">CloudVault</span>
          </Link>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          
          {/* Storage Progress */}
          {stats && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  พื้นที่ใช้งาน
                </span>
                <div className="flex items-center gap-2">
                  <span>{stats.percentage}%</span>
                  <button 
                    onClick={handleManualRefresh}
                    className="hover:text-white transition-colors"
                    title="รีเฟรช"
                  >
                    <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill transition-all duration-500"
                  style={{ width: `${Math.min(stats.percentage, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  {formatBytes(stats.used)} / {formatBytes(stats.limit)}
                </p>
                <p className="text-xs text-gray-500">
                  {stats.files_count} ไฟล์
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-700/50">
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

// Helper function to trigger storage update from other components
export function triggerStorageUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storage-updated'));
  }
}