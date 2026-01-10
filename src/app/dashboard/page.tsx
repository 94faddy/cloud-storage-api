'use client';

import { useState, useEffect } from 'react';
import { 
  FolderOpen, FileText, Image, Video, Music, Archive, 
  Upload, Activity, TrendingUp, HardDrive, Clock
} from 'lucide-react';
import Link from 'next/link';

interface StorageStats {
  used: number;
  limit: number;
  percentage: number;
  files_count: number;
  folders_count: number;
}

interface FileType {
  type: string;
  count: number;
  total_size: number;
}

interface ActivityLog {
  action: string;
  resource_type: string;
  details: any;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [fileTypes, setFileTypes] = useState<FileType[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/user/stats');
        const data = await res.json();
        if (data.success) {
          setStats(data.data.storage);
          setFileTypes(data.data.fileTypes || []);
          setRecentActivity(data.data.recentActivity || []);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'Images': return <Image className="w-5 h-5" />;
      case 'Videos': return <Video className="w-5 h-5" />;
      case 'Audio': return <Music className="w-5 h-5" />;
      case 'Documents': return <FileText className="w-5 h-5" />;
      case 'PDF': return <FileText className="w-5 h-5" />;
      default: return <Archive className="w-5 h-5" />;
    }
  };

  const getFileTypeColor = (type: string) => {
    switch (type) {
      case 'Images': return 'bg-pink-500/20 text-pink-400';
      case 'Videos': return 'bg-purple-500/20 text-purple-400';
      case 'Audio': return 'bg-green-500/20 text-green-400';
      case 'Documents': return 'bg-blue-500/20 text-blue-400';
      case 'PDF': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'upload': return 'อัพโหลด';
      case 'download': return 'ดาวน์โหลด';
      case 'delete': return 'ลบ';
      case 'create': return 'สร้าง';
      case 'share': return 'แชร์';
      default: return action;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">แดชบอร์ด</h1>
          <p className="text-gray-400 mt-1">ภาพรวมการใช้งาน Cloud Storage ของคุณ</p>
        </div>
        <Link href="/dashboard/files" className="btn-primary inline-flex items-center gap-2 w-fit">
          <Upload className="w-5 h-5" />
          อัพโหลดไฟล์
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Storage Used */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-white">{stats?.percentage || 0}%</span>
          </div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">พื้นที่ใช้งาน</h3>
          <div className="progress-bar mb-2">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(stats?.percentage || 0, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {formatBytes(stats?.used || 0)} / {formatBytes(stats?.limit || 0)}
          </p>
        </div>

        {/* Total Files */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-400 mb-1">ไฟล์ทั้งหมด</h3>
          <p className="text-2xl font-bold text-white">{stats?.files_count || 0}</p>
        </div>

        {/* Total Folders */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-yellow-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-yellow-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-400 mb-1">โฟลเดอร์ทั้งหมด</h3>
          <p className="text-2xl font-bold text-white">{stats?.folders_count || 0}</p>
        </div>

        {/* Storage Limit */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-400 mb-1">พื้นที่สูงสุด</h3>
          <p className="text-2xl font-bold text-white">{formatBytes(stats?.limit || 0)}</p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* File Types */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            ประเภทไฟล์
          </h2>
          {fileTypes.length > 0 ? (
            <div className="space-y-3">
              {fileTypes.map((type, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getFileTypeColor(type.type)}`}>
                      {getFileTypeIcon(type.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{type.type}</p>
                      <p className="text-xs text-gray-400">{type.count} ไฟล์</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300">{formatBytes(type.total_size)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีไฟล์</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            กิจกรรมล่าสุด
          </h2>
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => {
                const details = typeof activity.details === 'string' 
                  ? JSON.parse(activity.details) 
                  : activity.details;
                return (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-medium">{getActionLabel(activity.action)}</span>
                        {' '}
                        <span className="text-gray-400">{activity.resource_type}</span>
                        {details?.filename && (
                          <span className="text-blue-400 truncate block">{details.filename}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(activity.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีกิจกรรม</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">ดำเนินการด่วน</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/dashboard/files"
            className="p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-center"
          >
            <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-white">อัพโหลดไฟล์</p>
          </Link>
          <Link
            href="/dashboard/files"
            className="p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-center"
          >
            <FolderOpen className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm text-white">สร้างโฟลเดอร์</p>
          </Link>
          <Link
            href="/dashboard/apikeys"
            className="p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-center"
          >
            <Activity className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-white">สร้าง API Key</p>
          </Link>
          <Link
            href="/dashboard/docs"
            className="p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-center"
          >
            <FileText className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-sm text-white">เอกสาร API</p>
          </Link>
        </div>
      </div>
    </div>
  );
}