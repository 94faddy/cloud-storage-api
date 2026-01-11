export interface User {
  id: number;
  email: string;
  username: string;
  password?: string;
  storage_used: number;
  storage_limit: number;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ApiKey {
  id: number;
  user_id: number;
  name: string;
  api_key: string;
  key_prefix: string;
  permissions: string | ApiKeyPermissions;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: Date;
  expires_at: Date | null;
}

export interface File {
  id: number;
  user_id: number;
  folder_id: number | null;
  name: string;
  original_name: string;
  mime_type: string;
  size: number;
  path: string;
  is_public: boolean;
  public_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Folder {
  id: number;
  user_id: number;
  parent_id: number | null;
  name: string;
  path: string;
  is_public: boolean;
  public_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface StorageStats {
  used: number;
  limit: number;
  percentage: number;
  files_count: number;
  folders_count: number;
}

export interface JWTPayload {
  userId: number;
  email: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

export interface ApiKeyPermissions {
  upload: boolean;
  download: boolean;
  delete: boolean;
  list: boolean;
  createFolder: boolean;
  deleteFolder: boolean;
}

export interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  path: string;
  url: string;
}

export interface FileListItem extends File {
  type: 'file';
}

export interface FolderListItem extends Folder {
  type: 'folder';
  items_count?: number;
}

export type FileSystemItem = FileListItem | FolderListItem;

export interface UploadProgress {
  id: string;
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface ActivityLog {
  id: number;
  user_id: number;
  action: string;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface SharedContent {
  type: 'file' | 'folder';
  item: File | Folder;
  ownerName: string;
}
