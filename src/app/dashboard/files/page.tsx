'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload, FolderPlus, Folder, File as FileIcon, Image, Video, Music,
  FileText, Archive, Code, MoreVertical, Download, Trash2, Share2,
  ChevronRight, Home, RefreshCw, Grid, List, Search, X, Eye, Copy
} from 'lucide-react';
import Swal from 'sweetalert2';

interface FileItem {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  is_public: boolean;
  public_url: string | null;
  created_at: string;
}

interface FolderItem {
  id: number;
  name: string;
  path: string;
  created_at: string;
}

interface Breadcrumb {
  id: number | null;
  name: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'หน้าแรก' }]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async (folderId: number | null = null) => {
    setLoading(true);
    try {
      const url = folderId
        ? `/api/files/list?folderId=${folderId}`
        : '/api/files/list';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setFiles(data.data.files || []);
        setFolders(data.data.folders || []);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentFolder);
  }, [currentFolder]);

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      formData.append('files', file);
      // Get relative path for directory uploads
      const relativePath = (file as any).webkitRelativePath || '';
      formData.append('relativePaths', relativePath);
    }

    if (currentFolder) {
      formData.append('folderId', currentFolder.toString());
    }

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'อัพโหลดสำเร็จ!',
          text: data.message,
          background: '#1e293b',
          color: '#fff',
          confirmButtonColor: '#6366f1',
        });
        fetchFiles(currentFolder);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'อัพโหลดไม่สำเร็จ',
          text: data.error || 'เกิดข้อผิดพลาด',
          background: '#1e293b',
          color: '#fff',
          confirmButtonColor: '#6366f1',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถอัพโหลดไฟล์ได้',
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1',
      });
    } finally {
      setUploading(false);
      // Reset input values to allow re-uploading same file
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    const { value: folderName } = await Swal.fire({
      title: 'สร้างโฟลเดอร์ใหม่',
      input: 'text',
      inputPlaceholder: 'ชื่อโฟลเดอร์',
      showCancelButton: true,
      confirmButtonText: 'สร้าง',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#6366f1',
      inputValidator: (value) => {
        if (!value) return 'กรุณากรอกชื่อโฟลเดอร์';
        if (!/^[a-zA-Z0-9_\-\s\.]+$/.test(value)) return 'ชื่อโฟลเดอร์ไม่ถูกต้อง';
        return null;
      },
    });

    if (folderName) {
      try {
        const res = await fetch('/api/folders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: folderName,
            parentId: currentFolder,
          }),
        });
        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'สร้างโฟลเดอร์สำเร็จ!',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#fff',
          });
          fetchFiles(currentFolder);
        } else {
          Swal.fire({
            icon: 'error',
            title: 'สร้างไม่สำเร็จ',
            text: data.error,
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#6366f1',
          });
        }
      } catch (error) {
        console.error('Error creating folder:', error);
      }
    }
  };

  const handleDeleteFile = async (fileId: number, fileName: string) => {
    const result = await Swal.fire({
      title: 'ลบไฟล์?',
      text: `คุณต้องการลบ "${fileName}" หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/files/delete/${fileId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ!',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#fff',
          });
          fetchFiles(currentFolder);
        }
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
  };

  const handleDeleteFolder = async (folderId: number, folderName: string) => {
    const result = await Swal.fire({
      title: 'ลบโฟลเดอร์?',
      text: `คุณต้องการลบ "${folderName}" และไฟล์ทั้งหมดภายในหรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/folders/delete/${folderId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ!',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#fff',
          });
          fetchFiles(currentFolder);
        }
      } catch (error) {
        console.error('Error deleting folder:', error);
      }
    }
  };

  const handleShareFile = async (fileId: number, isCurrentlyPublic: boolean | number) => {
    const isPublic = Boolean(isCurrentlyPublic);
    try {
      const res = await fetch('/api/files/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, isPublic: !isPublic }),
      });
      const data = await res.json();

      if (data.success) {
        if (!isPublic && data.data.public_url) {
          const publicUrl = `${window.location.origin}/api/share/${data.data.public_url}`;
          await Swal.fire({
            title: 'แชร์สำเร็จ!',
            html: `
              <p class="text-gray-400 mb-4">ลิงก์สาธารณะ:</p>
              <input type="text" value="${publicUrl}" class="input text-sm" readonly />
            `,
            showConfirmButton: true,
            confirmButtonText: 'คัดลอกลิงก์',
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#3b82f6',
          });
          navigator.clipboard.writeText(publicUrl);
        } else {
          Swal.fire({
            icon: 'success',
            title: 'ยกเลิกการแชร์สำเร็จ',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#fff',
          });
        }
        fetchFiles(currentFolder);
      }
    } catch (error) {
      console.error('Error sharing file:', error);
    }
  };

  const handleDownload = (fileId: number) => {
    window.open(`/api/files/download/${fileId}`, '_blank');
  };

  const navigateToFolder = (folder: FolderItem) => {
    setCurrentFolder(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolder(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-6 h-6 text-pink-400" />;
    if (mimeType.startsWith('video/')) return <Video className="w-6 h-6 text-purple-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-6 h-6 text-green-400" />;
    if (mimeType.includes('pdf')) return <FileText className="w-6 h-6 text-red-400" />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) 
      return <Archive className="w-6 h-6 text-yellow-400" />;
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css'))
      return <Code className="w-6 h-6 text-orange-400" />;
    return <FileIcon className="w-6 h-6 text-gray-400" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredFiles = files.filter(f => 
    f.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const items = e.dataTransfer.items;
    if (items) {
      const fileList: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry?.();
        if (item) {
          if (item.isFile) {
            items[i].getAsFile() && fileList.push(items[i].getAsFile()!);
          }
        }
      }
      if (fileList.length > 0) {
        const dataTransfer = new DataTransfer();
        fileList.forEach(f => dataTransfer.items.add(f));
        handleFileUpload(dataTransfer.files);
      }
    } else if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">ไฟล์ของฉัน</h1>
          <p className="text-gray-400 mt-1">จัดการไฟล์และโฟลเดอร์ทั้งหมดของคุณ</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary flex items-center gap-2"
            disabled={uploading}
          >
            <Upload className="w-5 h-5" />
            {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดไฟล์'}
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="btn-secondary flex items-center gap-2"
            disabled={uploading}
          >
            <FolderPlus className="w-5 h-5" />
            อัพโหลดโฟลเดอร์
          </button>
          <button
            onClick={handleCreateFolder}
            className="btn-secondary flex items-center gap-2"
          >
            <FolderPlus className="w-5 h-5" />
            สร้างโฟลเดอร์
          </button>
        </div>
      </div>

      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Toolbar */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <ChevronRight className="w-4 h-4 text-gray-500 mx-1" />}
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700/50 transition-colors whitespace-nowrap ${
                    index === breadcrumbs.length - 1 ? 'text-blue-400' : 'text-gray-400'
                  }`}
                >
                  {index === 0 && <Home className="w-4 h-4" />}
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหา..."
                className="input pl-9 pr-9 py-2 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchFiles(currentFolder)}
              className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* View Mode */}
            <div className="flex items-center rounded-lg bg-gray-800/50 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`upload-area ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-300 mb-2">ลากไฟล์หรือโฟลเดอร์มาวางที่นี่</p>
        <p className="text-sm text-gray-500">หรือคลิกปุ่มด้านบนเพื่ออัพโหลด</p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <div className="text-center py-16">
          <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">ไม่มีไฟล์หรือโฟลเดอร์</p>
          <p className="text-gray-500 text-sm mt-2">เริ่มต้นด้วยการอัพโหลดไฟล์หรือสร้างโฟลเดอร์</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Folders */}
          {filteredFolders.map((folder) => (
            <div
              key={`folder-${folder.id}`}
              className="card p-4 cursor-pointer hover:border-blue-500/50 transition-all group"
              onDoubleClick={() => navigateToFolder(folder)}
            >
              <div className="flex items-center justify-between mb-3">
                <Folder className="w-10 h-10 text-yellow-400" />
                <div className="relative">
                  <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-all">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                  <div className="absolute right-0 top-8 hidden group-hover:block bg-gray-800 rounded-lg shadow-xl py-1 min-w-32 z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.name); }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> ลบ
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-white truncate">{folder.name}</p>
              <p className="text-xs text-gray-500 mt-1">{formatDate(folder.created_at)}</p>
            </div>
          ))}

          {/* Files */}
          {filteredFiles.map((file) => (
            <div
              key={`file-${file.id}`}
              className="card p-4 hover:border-blue-500/50 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  {getFileIcon(file.mime_type)}
                </div>
                <div className="relative">
                  <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-all">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                  <div className="absolute right-0 top-8 hidden group-hover:block bg-gray-800 rounded-lg shadow-xl py-1 min-w-32 z-10">
                    <button
                      onClick={() => handleDownload(file.id)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> ดาวน์โหลด
                    </button>
                    <button
                      onClick={() => handleShareFile(file.id, file.is_public)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Share2 className="w-4 h-4" /> {file.is_public ? 'ยกเลิกแชร์' : 'แชร์'}
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id, file.original_name)}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> ลบ
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-white truncate" title={file.original_name}>{file.original_name}</p>
              <p className="text-xs text-gray-500 mt-1">{formatBytes(file.size)}</p>
              {Boolean(file.is_public) && (
                <span className="badge badge-success text-xs mt-2 inline-block">สาธารณะ</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>ขนาด</th>
                <th>วันที่สร้าง</th>
                <th>สถานะ</th>
                <th className="text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {/* Folders */}
              {filteredFolders.map((folder) => (
                <tr
                  key={`folder-${folder.id}`}
                  className="cursor-pointer"
                  onDoubleClick={() => navigateToFolder(folder)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-yellow-400" />
                      <span className="text-white">{folder.name}</span>
                    </div>
                  </td>
                  <td className="text-gray-400">-</td>
                  <td className="text-gray-400">{formatDate(folder.created_at)}</td>
                  <td>-</td>
                  <td className="text-right">
                    <button
                      onClick={() => handleDeleteFolder(folder.id, folder.name)}
                      className="p-2 hover:bg-red-500/20 rounded text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Files */}
              {filteredFiles.map((file) => (
                <tr key={`file-${file.id}`}>
                  <td>
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.mime_type)}
                      <span className="text-white truncate max-w-xs">{file.original_name}</span>
                    </div>
                  </td>
                  <td className="text-gray-400">{formatBytes(file.size)}</td>
                  <td className="text-gray-400">{formatDate(file.created_at)}</td>
                  <td>
                    {file.is_public ? (
                      <span className="badge badge-success">สาธารณะ</span>
                    ) : (
                      <span className="badge badge-info">ส่วนตัว</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleDownload(file.id)}
                        className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                        title="ดาวน์โหลด"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShareFile(file.id, file.is_public)}
                        className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                        title={file.is_public ? 'ยกเลิกแชร์' : 'แชร์'}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id, file.original_name)}
                        className="p-2 hover:bg-red-500/20 rounded text-red-400"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
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
  );
}