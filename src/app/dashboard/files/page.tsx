'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FolderPlus, Folder, File as FileIcon, Image, Video, Music,
  FileText, Archive, Code, MoreVertical, Download, Trash2, Share2,
  ChevronRight, Home, RefreshCw, Grid, List, Search, X, Eye, Copy,
  CheckCircle, AlertCircle, Loader2, Link as LinkIcon, ExternalLink
} from 'lucide-react';
import Swal from 'sweetalert2';

// Helper function to trigger storage update
const triggerStorageUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storage-updated'));
  }
};

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
  is_public: boolean;
  public_url: string | null;
  created_at: string;
}

interface Breadcrumb {
  id: number | null;
  name: string;
}

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadedBytes: number;
  startTime: number;
  speed: number;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'หน้าแรก' }]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  
  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'file' | 'folder'; item: FileItem | FolderItem } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortControllers = useRef<Map<string, AbortController>>(new Map());

  const fetchFiles = useCallback(async (folderId: number | null = null) => {
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
  }, []);

  useEffect(() => {
    fetchFiles(currentFolder);
  }, [currentFolder, fetchFiles]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Generate unique ID for upload files
  const generateId = () => Math.random().toString(36).substring(2, 15);

  // Format bytes to readable string
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format speed (bytes/s to readable)
  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0 || !isFinite(seconds)) return '--:--';
    if (seconds < 60) return `${Math.round(seconds)}วิ`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}น ${secs}วิ`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}ชม ${mins}น`;
  };

  // Add files to upload queue
  const addFilesToQueue = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newFiles: UploadFile[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > 0 && file.name && file.name !== 'undefined') {
        newFiles.push({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          progress: 0,
          status: 'pending',
          uploadedBytes: 0,
          startTime: 0,
          speed: 0
        });
      }
    }

    if (newFiles.length > 0) {
      setUploadFiles(prev => [...prev, ...newFiles]);
      setShowUploadModal(true);
      setUploadComplete(false);
    }
  };

  // Upload single file with progress tracking
  const uploadSingleFile = async (uploadFile: UploadFile): Promise<boolean> => {
    const abortController = new AbortController();
    uploadAbortControllers.current.set(uploadFile.id, abortController);

    try {
      const startTime = Date.now();
      
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'uploading' as const, startTime } : f
      ));

      const formData = new FormData();
      formData.append('files', uploadFile.file);
      
      const relativePath = (uploadFile.file as any).webkitRelativePath || '';
      if (relativePath) {
        formData.append('relativePaths', relativePath);
      }

      if (currentFolder !== null) {
        formData.append('folderId', currentFolder.toString());
      }

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        let lastLoaded = 0;
        let lastTime = startTime;
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const now = Date.now();
            const progress = Math.round((event.loaded / event.total) * 100);
            
            const timeDiff = (now - lastTime) / 1000;
            const bytesDiff = event.loaded - lastLoaded;
            const currentSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
            
            setUploadFiles(prev => prev.map(f => {
              if (f.id === uploadFile.id) {
                const smoothedSpeed = f.speed > 0 
                  ? (f.speed * 0.7 + currentSpeed * 0.3) 
                  : currentSpeed;
                return { 
                  ...f, 
                  progress, 
                  uploadedBytes: event.loaded,
                  speed: smoothedSpeed
                };
              }
              return f;
            }));
            
            lastLoaded = event.loaded;
            lastTime = now;
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { ...f, status: 'completed' as const, progress: 100, uploadedBytes: f.size, speed: 0 } : f
            ));
            resolve(true);
          } else {
            let errorMsg = 'Upload failed';
            try {
              const response = JSON.parse(xhr.responseText);
              errorMsg = response.error || errorMsg;
            } catch (e) {}
            
            setUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { ...f, status: 'error' as const, error: errorMsg } : f
            ));
            resolve(false);
          }
        });

        xhr.addEventListener('error', () => {
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'error' as const, error: 'Network error' } : f
          ));
          resolve(false);
        });

        xhr.addEventListener('abort', () => {
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'error' as const, error: 'Cancelled' } : f
          ));
          resolve(false);
        });

        xhr.open('POST', '/api/files/upload');
        xhr.send(formData);

        abortController.signal.addEventListener('abort', () => {
          xhr.abort();
        });
      });
    } catch (error: any) {
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'error' as const, error: error.message } : f
      ));
      return false;
    } finally {
      uploadAbortControllers.current.delete(uploadFile.id);
    }
  };

  // Start uploading all files
  const startUpload = async () => {
    if (isUploading) return;
    
    setIsUploading(true);
    setUploadComplete(false);

    const pendingFiles = uploadFiles.filter(f => f.status === 'pending' || f.status === 'error');
    
    setUploadFiles(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'pending' as const, error: undefined, progress: 0, uploadedBytes: 0, speed: 0 } : f
    ));

    let completed = 0;
    let successful = 0;

    for (const uploadFile of pendingFiles) {
      const success = await uploadSingleFile(uploadFile);
      completed++;
      if (success) successful++;
      
      setTotalProgress(Math.round((completed / pendingFiles.length) * 100));
    }

    setIsUploading(false);
    setUploadComplete(true);
    
    fetchFiles(currentFolder);
    triggerStorageUpdate();

    if (successful === pendingFiles.length) {
      Swal.fire({
        icon: 'success',
        title: 'อัพโหลดสำเร็จ!',
        text: `อัพโหลด ${successful} ไฟล์สำเร็จ`,
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1',
        timer: 2000
      });
    } else if (successful > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'อัพโหลดบางส่วน',
        text: `สำเร็จ ${successful}/${pendingFiles.length} ไฟล์`,
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'อัพโหลดไม่สำเร็จ',
        text: 'ไม่สามารถอัพโหลดไฟล์ได้',
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#6366f1'
      });
    }
  };

  const cancelUpload = (fileId: string) => {
    const controller = uploadAbortControllers.current.get(fileId);
    if (controller) {
      controller.abort();
    }
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const cancelAllUploads = () => {
    uploadAbortControllers.current.forEach(controller => controller.abort());
    uploadAbortControllers.current.clear();
    setUploadFiles([]);
    setShowUploadModal(false);
    setIsUploading(false);
    setTotalProgress(0);
  };

  const removeFromQueue = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearCompleted = () => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  const closeUploadModal = () => {
    if (isUploading) {
      Swal.fire({
        title: 'ยกเลิกการอัพโหลด?',
        text: 'ไฟล์ที่กำลังอัพโหลดจะถูกยกเลิก',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'ยกเลิก',
        cancelButtonText: 'ดำเนินการต่อ',
        background: '#1e293b',
        color: '#f1f5f9'
      }).then((result) => {
        if (result.isConfirmed) {
          cancelAllUploads();
        }
      });
    } else {
      setUploadFiles([]);
      setShowUploadModal(false);
      setTotalProgress(0);
      setUploadComplete(false);
    }
  };

  const getTotalUploadStats = () => {
    const uploading = uploadFiles.filter(f => f.status === 'uploading');
    const totalBytes = uploading.reduce((sum, f) => sum + f.size, 0);
    const uploadedBytes = uploading.reduce((sum, f) => sum + f.uploadedBytes, 0);
    const avgSpeed = uploading.length > 0 
      ? uploading.reduce((sum, f) => sum + f.speed, 0) / uploading.length 
      : 0;
    const remainingBytes = totalBytes - uploadedBytes;
    const timeRemaining = avgSpeed > 0 ? remainingBytes / avgSpeed : 0;
    
    return { totalBytes, uploadedBytes, avgSpeed, timeRemaining };
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
        if (!/^[a-zA-Z0-9ก-๙_\-\s\.]+$/.test(value)) return 'ชื่อโฟลเดอร์ไม่ถูกต้อง';
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
          triggerStorageUpdate();
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
          triggerStorageUpdate();
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
          triggerStorageUpdate();
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
          const publicUrl = `${window.location.origin}/share/${data.data.public_url}`;
          await Swal.fire({
            title: 'แชร์สำเร็จ!',
            html: `
              <div class="text-left">
                <p class="text-gray-400 mb-3">ลิงก์สาธารณะ:</p>
                <div class="flex gap-2">
                  <input type="text" id="share-url" value="${publicUrl}" class="flex-1 px-3 py-2 bg-gray-700 rounded text-sm text-white" readonly />
                  <button onclick="navigator.clipboard.writeText('${publicUrl}'); this.innerHTML='✓'" class="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded text-white text-sm">คัดลอก</button>
                </div>
                <a href="${publicUrl}" target="_blank" class="text-blue-400 text-sm mt-3 inline-flex items-center gap-1 hover:underline">
                  เปิดดูลิงก์ <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </a>
              </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'ปิด',
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#3b82f6',
          });
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

  const handleShareFolder = async (folderId: number, isCurrentlyPublic: boolean | number) => {
    const isPublic = Boolean(isCurrentlyPublic);
    try {
      const res = await fetch('/api/folders/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, isPublic: !isPublic }),
      });
      const data = await res.json();

      if (data.success) {
        if (!isPublic && data.data.public_url) {
          const publicUrl = `${window.location.origin}/share/${data.data.public_url}`;
          await Swal.fire({
            title: 'แชร์โฟลเดอร์สำเร็จ!',
            html: `
              <div class="text-left">
                <p class="text-gray-400 mb-3">ลิงก์สาธารณะ:</p>
                <div class="flex gap-2">
                  <input type="text" id="share-url" value="${publicUrl}" class="flex-1 px-3 py-2 bg-gray-700 rounded text-sm text-white" readonly />
                  <button onclick="navigator.clipboard.writeText('${publicUrl}'); this.innerHTML='✓'" class="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded text-white text-sm">คัดลอก</button>
                </div>
                <p class="text-yellow-400 text-sm mt-3">⚠️ ผู้ที่มีลิงก์จะสามารถดูและดาวน์โหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ได้</p>
                <a href="${publicUrl}" target="_blank" class="text-blue-400 text-sm mt-2 inline-flex items-center gap-1 hover:underline">
                  เปิดดูลิงก์ <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </a>
              </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'ปิด',
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#3b82f6',
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: 'ยกเลิกการแชร์โฟลเดอร์สำเร็จ',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#fff',
          });
        }
        fetchFiles(currentFolder);
      }
    } catch (error) {
      console.error('Error sharing folder:', error);
    }
  };

  const handleCopyShareLink = (publicUrl: string, type: 'file' | 'folder') => {
    const fullUrl = `${window.location.origin}/share/${publicUrl}`;
    navigator.clipboard.writeText(fullUrl);
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกลิงก์แล้ว!',
      text: type === 'folder' ? 'ลิงก์โฟลเดอร์ถูกคัดลอกแล้ว' : 'ลิงก์ไฟล์ถูกคัดลอกแล้ว',
      timer: 1500,
      showConfirmButton: false,
      background: '#1e293b',
      color: '#fff',
    });
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
            const file = items[i].getAsFile();
            if (file) fileList.push(file);
          }
        }
      }
      if (fileList.length > 0) {
        const dataTransfer = new DataTransfer();
        fileList.forEach(f => dataTransfer.items.add(f));
        addFilesToQueue(dataTransfer.files);
      }
    } else if (e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const getCurrentPathDisplay = () => {
    if (breadcrumbs.length <= 1) return 'หน้าแรก (Root)';
    return breadcrumbs.map(b => b.name).join(' / ');
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'file' | 'folder', item: FileItem | FolderItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, item });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">ไฟล์ของฉัน</h1>
          <p className="text-gray-400 mt-1">จัดการไฟล์และโฟลเดอร์ทั้งหมดของคุณ</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            อัพโหลดไฟล์
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="btn-secondary flex items-center gap-2"
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

      {/* Current Path Info */}
      <div className="glass rounded-lg p-3 flex items-center gap-2">
        <Folder className="w-5 h-5 text-blue-400" />
        <span className="text-sm text-gray-400">ตำแหน่งปัจจุบัน:</span>
        <span className="text-sm text-white font-medium">{getCurrentPathDisplay()}</span>
        {currentFolder && (
          <span className="text-xs text-gray-500 ml-2">(ID: {currentFolder})</span>
        )}
      </div>

      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFilesToQueue(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={(e) => {
          addFilesToQueue(e.target.files);
          e.target.value = '';
        }}
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

            <button
              onClick={() => fetchFiles(currentFolder)}
              className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>

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
        <p className="text-sm text-gray-500">
          ไฟล์จะถูกอัพโหลดไปยัง: <span className="text-blue-400">{getCurrentPathDisplay()}</span>
        </p>
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
              className="card p-4 cursor-pointer hover:border-blue-500/50 transition-all group relative"
              onDoubleClick={() => navigateToFolder(folder)}
              onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="relative">
                  <Folder className="w-10 h-10 text-yellow-400" />
                  {folder.is_public && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <LinkIcon className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, 'folder', folder); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-all"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-white truncate">{folder.name}</p>
              <p className="text-xs text-gray-500 mt-1">{formatDate(folder.created_at)}</p>
              {folder.is_public && (
                <span className="badge badge-success text-xs mt-2 inline-block">แชร์แล้ว</span>
              )}
            </div>
          ))}

          {/* Files */}
          {filteredFiles.map((file) => (
            <div
              key={`file-${file.id}`}
              className="card p-4 hover:border-blue-500/50 transition-all group relative"
              onContextMenu={(e) => handleContextMenu(e, 'file', file)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="relative w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  {getFileIcon(file.mime_type)}
                  {file.is_public && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <LinkIcon className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, 'file', file); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-all"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-white truncate" title={file.original_name}>{file.original_name}</p>
              <p className="text-xs text-gray-500 mt-1">{formatBytes(file.size)}</p>
              {file.is_public && (
                <span className="badge badge-success text-xs mt-2 inline-block">แชร์แล้ว</span>
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
                  onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Folder className="w-5 h-5 text-yellow-400" />
                        {folder.is_public && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                      <span className="text-white">{folder.name}</span>
                    </div>
                  </td>
                  <td className="text-gray-400">-</td>
                  <td className="text-gray-400">{formatDate(folder.created_at)}</td>
                  <td>
                    {folder.is_public ? (
                      <span className="badge badge-success flex items-center gap-1 w-fit">
                        <LinkIcon className="w-3 h-3" />
                        แชร์แล้ว
                      </span>
                    ) : (
                      <span className="badge badge-secondary">ส่วนตัว</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShareFolder(folder.id, folder.is_public); }}
                        className={`p-2 hover:bg-gray-700 rounded ${folder.is_public ? 'text-green-400' : 'text-gray-400'} hover:text-white`}
                        title={folder.is_public ? 'ยกเลิกแชร์' : 'แชร์'}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      {folder.is_public && folder.public_url && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyShareLink(folder.public_url!, 'folder'); }}
                          className="p-2 hover:bg-gray-700 rounded text-blue-400 hover:text-blue-300"
                          title="คัดลอกลิงก์"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.name); }}
                        className="p-2 hover:bg-red-500/20 rounded text-red-400"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Files */}
              {filteredFiles.map((file) => (
                <tr 
                  key={`file-${file.id}`}
                  onContextMenu={(e) => handleContextMenu(e, 'file', file)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {getFileIcon(file.mime_type)}
                        {file.is_public && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                      <span className="text-white truncate max-w-xs">{file.original_name}</span>
                    </div>
                  </td>
                  <td className="text-gray-400">{formatBytes(file.size)}</td>
                  <td className="text-gray-400">{formatDate(file.created_at)}</td>
                  <td>
                    {file.is_public ? (
                      <span className="badge badge-success flex items-center gap-1 w-fit">
                        <LinkIcon className="w-3 h-3" />
                        แชร์แล้ว
                      </span>
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
                        className={`p-2 hover:bg-gray-700 rounded ${file.is_public ? 'text-green-400' : 'text-gray-400'} hover:text-white`}
                        title={file.is_public ? 'ยกเลิกแชร์' : 'แชร์'}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      {file.is_public && file.public_url && (
                        <button
                          onClick={() => handleCopyShareLink(file.public_url!, 'file')}
                          className="p-2 hover:bg-gray-700 rounded text-blue-400 hover:text-blue-300"
                          title="คัดลอกลิงก์"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 rounded-lg shadow-xl py-2 min-w-48 z-50 border border-gray-700"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'file' ? (
            <>
              <button
                onClick={() => { handleDownload((contextMenu.item as FileItem).id); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
              >
                <Download className="w-4 h-4" /> ดาวน์โหลด
              </button>
              <button
                onClick={() => { handleShareFile((contextMenu.item as FileItem).id, (contextMenu.item as FileItem).is_public); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
              >
                <Share2 className="w-4 h-4" /> {(contextMenu.item as FileItem).is_public ? 'ยกเลิกแชร์' : 'แชร์'}
              </button>
              {(contextMenu.item as FileItem).is_public && (contextMenu.item as FileItem).public_url && (
                <>
                  <button
                    onClick={() => { handleCopyShareLink((contextMenu.item as FileItem).public_url!, 'file'); setContextMenu(null); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                  >
                    <Copy className="w-4 h-4" /> คัดลอกลิงก์แชร์
                  </button>
                  <a
                    href={`/share/${(contextMenu.item as FileItem).public_url}`}
                    target="_blank"
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                  >
                    <ExternalLink className="w-4 h-4" /> เปิดลิงก์แชร์
                  </a>
                </>
              )}
              <hr className="my-2 border-gray-700" />
              <button
                onClick={() => { handleDeleteFile((contextMenu.item as FileItem).id, (contextMenu.item as FileItem).original_name); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-3"
              >
                <Trash2 className="w-4 h-4" /> ลบ
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { navigateToFolder(contextMenu.item as FolderItem); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
              >
                <Folder className="w-4 h-4" /> เปิดโฟลเดอร์
              </button>
              <button
                onClick={() => { handleShareFolder((contextMenu.item as FolderItem).id, (contextMenu.item as FolderItem).is_public); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
              >
                <Share2 className="w-4 h-4" /> {(contextMenu.item as FolderItem).is_public ? 'ยกเลิกแชร์' : 'แชร์โฟลเดอร์'}
              </button>
              {(contextMenu.item as FolderItem).is_public && (contextMenu.item as FolderItem).public_url && (
                <>
                  <button
                    onClick={() => { handleCopyShareLink((contextMenu.item as FolderItem).public_url!, 'folder'); setContextMenu(null); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                  >
                    <Copy className="w-4 h-4" /> คัดลอกลิงก์แชร์
                  </button>
                  <a
                    href={`/share/${(contextMenu.item as FolderItem).public_url}`}
                    target="_blank"
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                  >
                    <ExternalLink className="w-4 h-4" /> เปิดลิงก์แชร์
                  </a>
                </>
              )}
              <hr className="my-2 border-gray-700" />
              <button
                onClick={() => { handleDeleteFolder((contextMenu.item as FolderItem).id, (contextMenu.item as FolderItem).name); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-3"
              >
                <Trash2 className="w-4 h-4" /> ลบ
              </button>
            </>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Upload className="w-6 h-6 text-blue-400" />
                    อัพโหลดไฟล์
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    ไปยัง: <span className="text-blue-400">{getCurrentPathDisplay()}</span>
                  </p>
                </div>
                <button
                  onClick={closeUploadModal}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Total Progress with Speed */}
              {isUploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-400">กำลังอัพโหลด</span>
                    <div className="flex items-center gap-3">
                      <span className="text-green-400 font-bold">
                        {formatSpeed(getTotalUploadStats().avgSpeed)}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">
                        เหลือ {formatTimeRemaining(getTotalUploadStats().timeRemaining)}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-blue-400 font-bold">{totalProgress}%</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-gray-700 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                      style={{ width: `${totalProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-6">
              {uploadFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่มีไฟล์ในคิว</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {uploadFiles.map((uploadFile) => {
                    const remainingBytes = uploadFile.size - uploadFile.uploadedBytes;
                    const timeRemaining = uploadFile.speed > 0 ? remainingBytes / uploadFile.speed : 0;
                    
                    return (
                      <div 
                        key={uploadFile.id}
                        className={`p-4 rounded-lg border transition-all ${
                          uploadFile.status === 'completed' 
                            ? 'bg-green-500/10 border-green-500/30'
                            : uploadFile.status === 'error'
                            ? 'bg-red-500/10 border-red-500/30'
                            : uploadFile.status === 'uploading'
                            ? 'bg-blue-500/10 border-blue-500/30'
                            : 'bg-gray-800/50 border-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {uploadFile.status === 'completed' ? (
                              <CheckCircle className="w-6 h-6 text-green-400" />
                            ) : uploadFile.status === 'error' ? (
                              <AlertCircle className="w-6 h-6 text-red-400" />
                            ) : uploadFile.status === 'uploading' ? (
                              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                            ) : (
                              <FileIcon className="w-6 h-6 text-gray-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{uploadFile.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-gray-500">{formatBytes(uploadFile.size)}</span>
                              
                              {uploadFile.status === 'uploading' && (
                                <>
                                  <span className="text-xs text-gray-600">•</span>
                                  <span className="text-xs text-green-400 font-bold">
                                    {formatSpeed(uploadFile.speed)}
                                  </span>
                                  <span className="text-xs text-gray-600">•</span>
                                  <span className="text-xs text-gray-400">
                                    {formatBytes(uploadFile.uploadedBytes)} / {formatBytes(uploadFile.size)}
                                  </span>
                                  <span className="text-xs text-gray-600">•</span>
                                  <span className="text-xs text-blue-400">
                                    เหลือ {formatTimeRemaining(timeRemaining)}
                                  </span>
                                </>
                              )}
                              
                              {uploadFile.status === 'error' && uploadFile.error && (
                                <>
                                  <span className="text-xs text-gray-600">•</span>
                                  <span className="text-xs text-red-400">{uploadFile.error}</span>
                                </>
                              )}
                              
                              {uploadFile.status === 'completed' && (
                                <>
                                  <span className="text-xs text-gray-600">•</span>
                                  <span className="text-xs text-green-400">สำเร็จ</span>
                                </>
                              )}
                            </div>

                            {(uploadFile.status === 'uploading' || uploadFile.status === 'completed') && (
                              <div className="mt-2 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    uploadFile.status === 'completed' 
                                      ? 'bg-green-500' 
                                      : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${uploadFile.progress}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {uploadFile.status === 'uploading' && (
                            <span className="text-sm font-bold text-blue-400 min-w-[45px] text-right">
                              {uploadFile.progress}%
                            </span>
                          )}

                          <div className="flex-shrink-0">
                            {uploadFile.status === 'uploading' ? (
                              <button
                                onClick={() => cancelUpload(uploadFile.id)}
                                className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                                title="ยกเลิก"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => removeFromQueue(uploadFile.id)}
                                className="p-1.5 hover:bg-gray-700 rounded text-gray-400"
                                title="ลบออกจากคิว"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {uploadFiles.length} ไฟล์ • 
                  {uploadFiles.filter(f => f.status === 'completed').length} สำเร็จ •
                  {uploadFiles.filter(f => f.status === 'error').length} ล้มเหลว
                </div>
                <div className="flex items-center gap-3">
                  {uploadFiles.some(f => f.status === 'completed') && (
                    <button
                      onClick={clearCompleted}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      ล้างที่สำเร็จ
                    </button>
                  )}
                  <button
                    onClick={closeUploadModal}
                    className="btn-secondary"
                  >
                    ปิด
                  </button>
                  {uploadFiles.some(f => f.status === 'pending' || f.status === 'error') && !isUploading && (
                    <button
                      onClick={startUpload}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      เริ่มอัพโหลด
                    </button>
                  )}
                  {isUploading && (
                    <button
                      onClick={cancelAllUploads}
                      className="btn-danger flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      ยกเลิกทั้งหมด
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
