'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Trash2, ToggleLeft, ToggleRight, Clock, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import Swal from 'sweetalert2';

interface ApiKey {
  id: number;
  key_prefix: string;
  api_key: string;  // Added this property
  name: string;
  permissions: {
    upload: boolean;
    download: boolean;
    delete: boolean;
    list: boolean;
    createFolder: boolean;
    deleteFolder: boolean;
  };
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState({
    upload: true,
    download: true,
    delete: false,
    list: true,
    createFolder: true,
    deleteFolder: false
  });
  const [generatedKey, setGeneratedKey] = useState('');

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/apikeys/list');
      const data = await res.json();
      if (data.success) {
        setApiKeys(data.data);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'กรุณาใส่ชื่อ API Key',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }

    try {
      const res = await fetch('/api/apikeys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          permissions: newKeyPermissions,
          expiresIn: newKeyExpiry ? parseInt(newKeyExpiry) : null
        })
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedKey(data.data.api_key);
        fetchApiKeys();
        Swal.fire({
          icon: 'success',
          title: 'สร้าง API Key สำเร็จ!',
          html: `
            <div class="text-left">
              <p class="mb-2">กรุณาคัดลอก API Key นี้เก็บไว้:</p>
              <code class="bg-gray-700 px-3 py-2 rounded block break-all text-sm">${data.data.api_key}</code>
              <p class="text-yellow-400 mt-2 text-sm">⚠️ Key นี้จะแสดงเพียงครั้งเดียวเท่านั้น!</p>
            </div>
          `,
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#3b82f6'
        });
        setShowCreateModal(false);
        setNewKeyName('');
        setNewKeyExpiry('');
        setNewKeyPermissions({
          upload: true,
          download: true,
          delete: false,
          list: true,
          createFolder: true,
          deleteFolder: false
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

  const toggleKeyStatus = async (keyId: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/apikeys/revoke/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      const data = await res.json();
      if (data.success) {
        fetchApiKeys();
        Swal.fire({
          icon: 'success',
          title: currentStatus ? 'ปิดใช้งาน API Key แล้ว' : 'เปิดใช้งาน API Key แล้ว',
          background: '#1e293b',
          color: '#f1f5f9',
          timer: 1500
        });
      }
    } catch (error) {
      console.error('Error toggling key:', error);
    }
  };

  const deleteApiKey = async (keyId: number) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'ยืนยันการลบ?',
      text: 'API Key นี้จะถูกลบถาวรและไม่สามารถกู้คืนได้',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'ลบเลย',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/apikeys/revoke/${keyId}`, {
          method: 'DELETE'
        });

        const data = await res.json();
        if (data.success) {
          fetchApiKeys();
          Swal.fire({
            icon: 'success',
            title: 'ลบ API Key แล้ว',
            background: '#1e293b',
            color: '#f1f5f9',
            timer: 1500
          });
        }
      } catch (error) {
        console.error('Error deleting key:', error);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกแล้ว!',
      background: '#1e293b',
      color: '#f1f5f9',
      timer: 1000,
      showConfirmButton: false
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">จัดการ API Keys</h1>
          <p className="text-gray-400 mt-1">สร้างและจัดการ API Keys สำหรับเชื่อมต่อระบบภายนอก</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          สร้าง API Key ใหม่
        </button>
      </div>

      {/* API Keys List */}
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-gray-400">กำลังโหลด...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">ยังไม่มี API Key</p>
            <p className="text-sm text-gray-500">สร้าง API Key เพื่อเชื่อมต่อจากระบบภายนอก</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-300">ชื่อ</th>
                  <th className="text-left p-4 font-medium text-gray-300">Key</th>
                  <th className="text-left p-4 font-medium text-gray-300">สิทธิ์</th>
                  <th className="text-left p-4 font-medium text-gray-300">สถานะ</th>
                  <th className="text-left p-4 font-medium text-gray-300">หมดอายุ</th>
                  <th className="text-left p-4 font-medium text-gray-300">ใช้งานล่าสุด</th>
                  <th className="text-right p-4 font-medium text-gray-300">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-blue-400" />
                        <span className="font-medium">{key.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-700 px-2 py-1 rounded text-sm font-mono">
                          {key.api_key || key.key_prefix + '...'}
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.api_key || '')}
                          className="text-gray-400 hover:text-white transition-colors"
                          title="คัดลอก"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.upload && (
                          <span className="badge badge-success text-xs">อัพโหลด</span>
                        )}
                        {key.permissions.download && (
                          <span className="badge badge-info text-xs">ดาวน์โหลด</span>
                        )}
                        {key.permissions.delete && (
                          <span className="badge badge-danger text-xs">ลบ</span>
                        )}
                        {key.permissions.list && (
                          <span className="badge badge-warning text-xs">รายการ</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {isExpired(key.expires_at) ? (
                        <span className="badge badge-danger flex items-center gap-1 w-fit">
                          <AlertCircle className="w-3 h-3" />
                          หมดอายุ
                        </span>
                      ) : key.is_active ? (
                        <span className="badge badge-success flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          ใช้งาน
                        </span>
                      ) : (
                        <span className="badge badge-secondary flex items-center gap-1 w-fit">
                          ปิดใช้งาน
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {key.expires_at ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(key.expires_at)}
                        </div>
                      ) : (
                        <span className="text-gray-500">ไม่มีกำหนด</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {formatDate(key.last_used_at)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleKeyStatus(key.id, key.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            key.is_active
                              ? 'text-green-400 hover:bg-green-500/20'
                              : 'text-gray-400 hover:bg-gray-700'
                          }`}
                          title={key.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        >
                          {key.is_active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteApiKey(key.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" />
              สร้าง API Key ใหม่
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ชื่อ API Key</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="เช่น Production API, Mobile App"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">หมดอายุใน (วัน)</label>
                <input
                  type="number"
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                  placeholder="เว้นว่างไว้ = ไม่มีกำหนด"
                  className="input w-full"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">สิทธิ์การใช้งาน</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'upload', label: 'อัพโหลด', icon: '📤' },
                    { key: 'download', label: 'ดาวน์โหลด', icon: '📥' },
                    { key: 'delete', label: 'ลบไฟล์', icon: '🗑️' },
                    { key: 'list', label: 'ดูรายการ', icon: '📋' },
                    { key: 'createFolder', label: 'สร้างโฟลเดอร์', icon: '📁' },
                    { key: 'deleteFolder', label: 'ลบโฟลเดอร์', icon: '🗂️' }
                  ].map((perm) => (
                    <label
                      key={perm.key}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        newKeyPermissions[perm.key as keyof typeof newKeyPermissions]
                          ? 'bg-blue-500/20 border border-blue-500/50'
                          : 'bg-gray-700/50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newKeyPermissions[perm.key as keyof typeof newKeyPermissions]}
                        onChange={(e) =>
                          setNewKeyPermissions({
                            ...newKeyPermissions,
                            [perm.key]: e.target.checked
                          })
                        }
                        className="rounded border-gray-600"
                      />
                      <span>{perm.icon}</span>
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                onClick={createApiKey}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                สร้าง API Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}