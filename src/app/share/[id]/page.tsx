'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Cloud, Download, Folder, File as FileIcon, Image, Video, Music,
  FileText, Archive, Code, ChevronRight, Eye, X, ExternalLink, 
  AlertCircle, Loader2, Calendar, HardDrive, FileType
} from 'lucide-react';

interface SharedFile {
  id: number;
  name: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

interface SharedFolder {
  id: number;
  name: string;
  path: string;
  created_at: string;
}

interface SharedContent {
  type: 'file' | 'folder';
  item: SharedFile | SharedFolder;
  ownerName: string;
  contents?: {
    files: SharedFile[];
    folders: SharedFolder[];
  };
}

export default function SharePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const shareId = params.id as string;
  const subPath = searchParams.get('path') || '';

  const [content, setContent] = useState<SharedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ name: string; path: string }[]>([]);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = subPath
        ? `/api/share/${shareId}?path=${encodeURIComponent(subPath)}`
        : `/api/share/${shareId}`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'ไม่พบข้อมูลที่แชร์หรือลิงก์หมดอายุ');
        return;
      }

      setContent(data.data);

      if (data.data.type === 'folder') {
        const crumbs = [{ name: (data.data.item as SharedFolder).name, path: '' }];
        if (subPath) {
          const parts = subPath.split('/');
          let currentPath = '';
          parts.forEach((part) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            crumbs.push({ name: part, path: currentPath });
          });
        }
        setBreadcrumbs(crumbs);
      }
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [shareId, subPath]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (mimeType: string, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-12 h-12' : 'w-6 h-6';
    if (mimeType.startsWith('image/')) return <Image className={`${sizeClass} text-pink-400`} />;
    if (mimeType.startsWith('video/')) return <Video className={`${sizeClass} text-purple-400`} />;
    if (mimeType.startsWith('audio/')) return <Music className={`${sizeClass} text-green-400`} />;
    if (mimeType.includes('pdf')) return <FileText className={`${sizeClass} text-red-400`} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) 
      return <Archive className={`${sizeClass} text-yellow-400`} />;
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css') || mimeType.startsWith('text/'))
      return <Code className={`${sizeClass} text-orange-400`} />;
    return <FileIcon className={`${sizeClass} text-gray-400`} />;
  };

  const getFileBgColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'from-pink-500/20 to-pink-600/10';
    if (mimeType.startsWith('video/')) return 'from-purple-500/20 to-purple-600/10';
    if (mimeType.startsWith('audio/')) return 'from-green-500/20 to-green-600/10';
    if (mimeType.includes('pdf')) return 'from-red-500/20 to-red-600/10';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'from-yellow-500/20 to-yellow-600/10';
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.startsWith('text/'))
      return 'from-orange-500/20 to-orange-600/10';
    return 'from-gray-500/20 to-gray-600/10';
  };

  const isPreviewable = (mimeType: string, fileName: string = '') => {
    // รองรับทุกไฟล์ - return true เสมอ
    return true;
  };

  const canShowPreview = (mimeType: string, fileName: string = '') => {
    // ไฟล์ที่สามารถแสดง preview ได้จริงๆ
    if (mimeType.startsWith('image/')) return true;
    if (mimeType.startsWith('video/')) return true;
    if (mimeType.startsWith('audio/')) return true;
    if (mimeType === 'application/pdf') return true;
    if (mimeType.startsWith('text/')) return true;
    if (mimeType === 'application/json') return true;
    if (mimeType === 'application/xml') return true;
    if (mimeType === 'application/javascript') return true;
    
    // ตรวจสอบจากนามสกุลไฟล์สำหรับไฟล์ text-based
    const textExtensions = [
      '.txt', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.tsx', 
      '.jsx', '.vue', '.svelte', '.php', '.py', '.rb', '.java', '.c', '.cpp', 
      '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.kt', '.scala', '.sh', 
      '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.yaml', '.yml', 
      '.toml', '.ini', '.conf', '.config', '.env', '.gitignore', '.dockerignore',
      '.md', '.markdown', '.rst', '.tex', '.sql', '.graphql', '.prisma',
      '.ejs', '.hbs', '.pug', '.jade', '.twig', '.blade.php', '.erb',
      '.sass', '.scss', '.less', '.styl', '.csv', '.tsv', '.log',
      '.htaccess', '.nginx', '.apache', 'Dockerfile', 'Makefile', '.mk',
      '.r', '.R', '.m', '.matlab', '.lua', '.perl', '.pl', '.pm'
    ];
    
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (textExtensions.includes(ext)) return true;
    
    // ไฟล์ที่ไม่รู้จัก mime type แต่อาจเป็น text
    if (mimeType === 'application/octet-stream') {
      return textExtensions.includes(ext);
    }
    
    return false;
  };

  const handleDownload = (file: SharedFile) => {
    const url = content?.type === 'folder'
      ? `/api/share/${shareId}/download?fileId=${file.id}`
      : `/api/share/${shareId}/download`;
    window.open(url, '_blank');
  };

  const handlePreview = (file: SharedFile) => {
    setPreviewFile(file);
  };

  const handleFolderClick = (folder: SharedFolder) => {
    const newPath = subPath ? `${subPath}/${folder.name}` : folder.name;
    router.push(`/share/${shareId}?path=${encodeURIComponent(newPath)}`);
  };

  const handleBreadcrumbClick = (path: string) => {
    if (path === '') {
      router.push(`/share/${shareId}`);
    } else {
      router.push(`/share/${shareId}?path=${encodeURIComponent(path)}`);
    }
  };

  const getPreviewUrl = (file: SharedFile) => {
    return content?.type === 'folder'
      ? `/api/share/${shareId}/preview?fileId=${file.id}`
      : `/api/share/${shareId}/preview`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin mx-auto"></div>
            <Cloud className="w-8 h-8 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-400 mt-6 text-lg">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-10 max-w-md w-full text-center border border-red-500/20">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">ไม่พบลิงก์ที่แชร์</h1>
          <p className="text-gray-400 mb-8">{error}</p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
            <Cloud className="w-5 h-5" />
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  if (!content) return null;

  // Single file view
  if (content.type === 'file') {
    const file = content.item as SharedFile;
    const previewUrl = getPreviewUrl(file);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <header className="border-b border-gray-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <Link href="/" className="flex items-center gap-3 w-fit">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">CloudVault</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="glass rounded-3xl overflow-hidden border border-gray-700/50">
            {/* Preview Section */}
            {isPreviewable(file.mime_type) && (
              <div className="bg-black/40 border-b border-gray-700/50">
                <FilePreview file={file} previewUrl={previewUrl} isLarge={true} />
              </div>
            )}

            {/* File Info Section */}
            <div className="p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                {/* File Icon */}
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getFileBgColor(file.mime_type)} flex items-center justify-center flex-shrink-0`}>
                  {getFileIcon(file.mime_type, 'lg')}
                </div>
                
                {/* File Details */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-white truncate mb-4">
                    {file.original_name}
                  </h1>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 text-gray-400">
                      <HardDrive className="w-5 h-5 text-blue-400" />
                      <span>{formatBytes(file.size)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <FileType className="w-5 h-5 text-purple-400" />
                      <span className="truncate">{file.mime_type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <Calendar className="w-5 h-5 text-green-400" />
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-gray-700/50">
                <button
                  onClick={() => handleDownload(file)}
                  className="btn-primary flex items-center gap-2 px-6 py-3"
                >
                  <Download className="w-5 h-5" />
                  ดาวน์โหลด
                </button>
                {isPreviewable(file.mime_type) && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex items-center gap-2 px-6 py-3"
                  >
                    <ExternalLink className="w-5 h-5" />
                    เปิดในแท็บใหม่
                  </a>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Folder view
  const folder = content.item as SharedFolder;
  const contents = content.contents;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CloudVault</span>
          </Link>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 text-sm flex-wrap glass rounded-xl px-4 py-3">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4 text-gray-500" />}
              <button
                onClick={() => handleBreadcrumbClick(crumb.path)}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                  index === breadcrumbs.length - 1
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {index === 0 && <Folder className="w-4 h-4 text-yellow-400" />}
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        {!contents?.files.length && !contents?.folders.length ? (
          <div className="glass rounded-3xl p-16 text-center border border-gray-700/50">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-500/20 to-gray-600/10 flex items-center justify-center mx-auto mb-6">
              <Folder className="w-12 h-12 text-gray-500" />
            </div>
            <p className="text-gray-400 text-xl">โฟลเดอร์นี้ว่างเปล่า</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Folders */}
            {contents?.folders && contents.folders.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 mb-4 px-1">โฟลเดอร์ ({contents.folders.length})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contents.folders.map((subfolder) => (
                    <button
                      key={subfolder.id}
                      onClick={() => handleFolderClick(subfolder)}
                      className="glass rounded-2xl p-5 text-left group hover:bg-gray-700/30 hover:border-blue-500/30 border border-transparent transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Folder className="w-7 h-7 text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate group-hover:text-blue-400 transition-colors">
                            {subfolder.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(subfolder.created_at)}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {contents?.files && contents.files.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 mb-4 px-1">ไฟล์ ({contents.files.length})</h2>
                <div className="glass rounded-2xl overflow-hidden border border-gray-700/50">
                  <div className="divide-y divide-gray-700/50">
                    {contents.files.map((file) => (
                      <div
                        key={file.id}
                        className="p-5 hover:bg-gray-700/20 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          {/* Thumbnail/Icon */}
                          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getFileBgColor(file.mime_type)} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                            {file.mime_type.startsWith('image/') ? (
                              <img 
                                src={getPreviewUrl(file)} 
                                alt={file.original_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const sibling = target.nextElementSibling as HTMLElement;
                                  if (sibling) sibling.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={file.mime_type.startsWith('image/') ? 'hidden' : ''}>
                              {getFileIcon(file.mime_type, 'lg')}
                            </div>
                          </div>
                          
                          {/* File Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">
                              {file.original_name}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                              <span>{formatBytes(file.size)}</span>
                              <span>•</span>
                              <span>{formatDate(file.created_at)}</span>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isPreviewable(file.mime_type) && (
                              <button
                                onClick={() => handlePreview(file)}
                                className="p-3 rounded-xl bg-gray-700/50 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-all"
                                title="ดูตัวอย่าง"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDownload(file)}
                              className="p-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 transition-all"
                              title="ดาวน์โหลด"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          previewUrl={getPreviewUrl(previewFile)}
          onClose={() => setPreviewFile(null)}
          onDownload={() => handleDownload(previewFile)}
        />
      )}
    </div>
  );
}

// File Preview Component
function FilePreview({ file, previewUrl, isLarge = false }: { file: SharedFile; previewUrl: string; isLarge?: boolean }) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // ตรวจสอบว่าเป็นไฟล์ text-based หรือไม่
  const isTextBasedFile = (mimeType: string, fileName: string) => {
    if (mimeType.startsWith('text/')) return true;
    if (mimeType === 'application/json') return true;
    if (mimeType === 'application/xml') return true;
    if (mimeType === 'application/javascript') return true;
    
    const textExtensions = [
      '.txt', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.tsx', 
      '.jsx', '.vue', '.svelte', '.php', '.py', '.rb', '.java', '.c', '.cpp', 
      '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.kt', '.scala', '.sh', 
      '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.yaml', '.yml', 
      '.toml', '.ini', '.conf', '.config', '.env', '.gitignore', '.dockerignore',
      '.md', '.markdown', '.rst', '.tex', '.sql', '.graphql', '.prisma',
      '.ejs', '.hbs', '.pug', '.jade', '.twig', '.blade.php', '.erb',
      '.sass', '.scss', '.less', '.styl', '.csv', '.tsv', '.log',
      '.htaccess', '.nginx', '.apache', '.r', '.R', '.m', '.lua', '.perl', '.pl', '.pm'
    ];
    
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return textExtensions.includes(ext);
  };

  // ตรวจสอบว่าสามารถ preview ได้จริงหรือไม่
  const canShowPreview = (mimeType: string, fileName: string) => {
    if (mimeType.startsWith('image/')) return true;
    if (mimeType.startsWith('video/')) return true;
    if (mimeType.startsWith('audio/')) return true;
    if (mimeType === 'application/pdf') return true;
    return isTextBasedFile(mimeType, fileName);
  };

  useEffect(() => {
    setLoading(true);
    setError(false);
    setTextContent(null);
    
    if (isTextBasedFile(file.mime_type, file.original_name)) {
      fetch(previewUrl)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.text();
        })
        .then(text => {
          setTextContent(text);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    } else if (!canShowPreview(file.mime_type, file.original_name)) {
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [file, previewUrl]);

  const maxHeight = isLarge ? 'max-h-[600px]' : 'max-h-[400px]';

  // ถ้าไม่สามารถ preview ได้
  if (!canShowPreview(file.mime_type, file.original_name)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-500/20 to-gray-600/10 flex items-center justify-center mb-6">
          <FileIcon className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-400 text-lg font-medium mb-2">Preview not available for this file type</p>
        <p className="text-gray-500 text-sm">{file.mime_type || 'Unknown type'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <p className="text-gray-400 text-lg">ไม่สามารถโหลดตัวอย่างได้</p>
      </div>
    );
  }

  // Image preview
  if (file.mime_type.startsWith('image/')) {
    return (
      <div className={`flex items-center justify-center ${maxHeight} p-6 relative`}>
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        )}
        <img
          src={previewUrl}
          alt={file.original_name}
          className={`max-w-full ${maxHeight} object-contain rounded-lg transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
        />
      </div>
    );
  }

  // Video preview
  if (file.mime_type.startsWith('video/')) {
    return (
      <div className={`flex items-center justify-center ${maxHeight} p-6`}>
        <video
          src={previewUrl}
          controls
          className={`max-w-full ${maxHeight} rounded-lg`}
          preload="metadata"
        >
          เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ
        </video>
      </div>
    );
  }

  // Audio preview
  if (file.mime_type.startsWith('audio/')) {
    return (
      <div className="flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-md glass rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center">
              <Music className="w-8 h-8 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{file.original_name}</p>
              <p className="text-sm text-gray-400">Audio File</p>
            </div>
          </div>
          <audio src={previewUrl} controls className="w-full" preload="metadata" />
        </div>
      </div>
    );
  }

  // PDF preview
  if (file.mime_type === 'application/pdf') {
    return (
      <div className="p-4">
        <iframe
          src={previewUrl}
          className="w-full h-[500px] rounded-lg bg-white"
          title={file.original_name}
        />
      </div>
    );
  }

  // Text preview (รองรับทุกไฟล์ text-based)
  if (textContent !== null) {
    // ดึง extension สำหรับแสดง syntax highlighting hint
    const ext = file.original_name.toLowerCase().substring(file.original_name.lastIndexOf('.') + 1);
    
    return (
      <div className={`${maxHeight} overflow-auto p-4`}>
        <div className="bg-gray-900/80 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700/50">
            <span className="text-xs text-gray-400 font-mono">{file.original_name}</span>
            <span className="text-xs text-gray-500 uppercase">{ext}</span>
          </div>
          <pre className="p-6 text-sm text-gray-300 font-mono whitespace-pre-wrap break-words overflow-auto">
            {textContent}
          </pre>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return null;
}

// Preview Modal Component
function PreviewModal({
  file,
  previewUrl,
  onClose,
  onDownload
}: {
  file: SharedFile;
  previewUrl: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-slate-900/80">
        <h3 className="text-white font-medium truncate pr-4 flex items-center gap-3">
          <FileIcon className="w-5 h-5 text-blue-400" />
          {file.original_name}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="ดาวน์โหลด"
          >
            <Download className="w-5 h-5" />
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="เปิดในแท็บใหม่"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors ml-2"
            title="ปิด (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <FilePreview file={file} previewUrl={previewUrl} isLarge={true} />
      </div>
    </div>
  );
}