'use client';

import { useState } from 'react';
import { Book, Copy, ChevronDown, ChevronRight, Code, Upload, Download, Trash2, FolderPlus, List, Key, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import Swal from 'sweetalert2';

interface Endpoint {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: 'API Key' | 'Cookie' | 'None';
  headers?: Record<string, string>;
  body?: Record<string, any>;
  response?: Record<string, any>;
  example?: string;
}

interface EndpointGroup {
  title: string;
  icon: React.ReactNode;
  endpoints: Endpoint[];
}

const methodColors: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  PATCH: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
};

export default function DocsPage() {
  const [expandedSections, setExpandedSections] = useState<string[]>(['public', 'files']);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Parse max file size - 0 or empty means unlimited
  const maxFileSizeMB = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '0', 10);
  const isFileSizeUnlimited = maxFileSizeMB === 0 || isNaN(maxFileSizeMB);

  // Format file size display
  const formatMaxFileSize = () => {
    if (isFileSizeUnlimited) {
      return 'ไม่จำกัด';
    }
    if (maxFileSizeMB >= 1024) {
      return `${(maxFileSizeMB / 1024).toFixed(1)} GB`;
    }
    return `${maxFileSizeMB} MB`;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
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

  const endpointGroups: Record<string, EndpointGroup> = {
    public: {
      title: 'Public API (External)',
      icon: <Globe className="w-5 h-5" />,
      endpoints: [
        {
          method: 'POST',
          path: '/api/public/upload',
          description: 'อัพโหลดไฟล์ผ่าน API Key',
          auth: 'API Key',
          headers: {
            'X-API-Key': 'cv_your_api_key_here',
            'Content-Type': 'multipart/form-data'
          },
          body: {
            file: 'File (ไฟล์ที่ต้องการอัพโหลด)',
            folderId: 'number? (ID โฟลเดอร์)'
          },
          response: {
            success: true,
            data: {
              id: 1,
              name: 'photo.jpg',
              size: 1024000,
              mime_type: 'image/jpeg',
              download_url: '/api/public/download/1'
            }
          },
          example: `// Node.js Example
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('./photo.jpg'));

fetch('${baseUrl}/api/public/upload', {
  method: 'POST',
  headers: {
    'X-API-Key': 'cv_your_api_key_here'
  },
  body: form
});

// cURL Example
curl -X POST ${baseUrl}/api/public/upload \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -F "file=@./photo.jpg"`
        },
        {
          method: 'GET',
          path: '/api/public/download/:id',
          description: 'ดาวน์โหลดไฟล์ (ใช้ File ID หรือ Public UUID)',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          response: { type: 'Binary file stream' },
          example: `// Download by File ID
fetch('${baseUrl}/api/public/download/123', {
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});

// Download by Public UUID (ไม่ต้องใช้ API Key)
fetch('${baseUrl}/api/public/download/abc123-uuid-here');

// cURL
curl -H "X-API-Key: cv_your_api_key_here" \\
  ${baseUrl}/api/public/download/123 -o file.jpg`
        },
        {
          method: 'GET',
          path: '/api/public/list',
          description: 'แสดงรายการไฟล์ทั้งหมด',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          body: { folderId: 'number? (ID โฟลเดอร์)' },
          response: {
            success: true,
            data: {
              files: ['{ id, name, size, mime_type, download_url }'],
              folders: ['{ id, name }']
            }
          },
          example: `fetch('${baseUrl}/api/public/list?folderId=1', {
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});`
        },
        {
          method: 'DELETE',
          path: '/api/public/delete/:id',
          description: 'ลบไฟล์',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          response: { success: true, message: 'ลบไฟล์สำเร็จ' },
          example: `fetch('${baseUrl}/api/public/delete/123', {
  method: 'DELETE',
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});`
        },
        {
          method: 'POST',
          path: '/api/public/folders/create',
          description: 'สร้างโฟลเดอร์ใหม่',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          body: {
            name: 'string (ชื่อโฟลเดอร์)',
            parentId: 'number? (ID โฟลเดอร์ parent)'
          },
          response: {
            success: true,
            data: { id: 1, name: 'My Folder', path: '/My Folder' }
          },
          example: `fetch('${baseUrl}/api/public/folders/create', {
  method: 'POST',
  headers: { 
    'X-API-Key': 'cv_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Folder',
    parentId: null
  })
});`
        },
        {
          method: 'DELETE',
          path: '/api/public/folders/delete/:id',
          description: 'ลบโฟลเดอร์ (รวมไฟล์ภายใน)',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          response: { success: true, message: 'ลบโฟลเดอร์สำเร็จ' },
          example: `fetch('${baseUrl}/api/public/folders/delete/1', {
  method: 'DELETE',
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});`
        }
      ]
    },
    files: {
      title: 'Files Management (Web Only)',
      icon: <Upload className="w-5 h-5" />,
      endpoints: [
        {
          method: 'POST',
          path: '/api/files/upload',
          description: 'อัพโหลดไฟล์ (ต้อง Login)',
          auth: 'Cookie',
          headers: { 'Content-Type': 'multipart/form-data' },
          body: {
            files: 'File[] (ไฟล์ที่ต้องการอัพโหลด)',
            folderId: 'number? (ID โฟลเดอร์, optional)',
            relativePath: 'string? (path สำหรับ directory upload)'
          },
          response: {
            success: true,
            data: {
              uploaded: ['{ id, name, size, mime_type }'],
              failed: []
            }
          }
        },
        {
          method: 'GET',
          path: '/api/files/download/:id',
          description: 'ดาวน์โหลดไฟล์',
          auth: 'Cookie',
          response: { type: 'Binary file stream' }
        },
        {
          method: 'DELETE',
          path: '/api/files/delete/:id',
          description: 'ลบไฟล์',
          auth: 'Cookie',
          response: { success: true, message: 'ลบไฟล์สำเร็จ' }
        },
        {
          method: 'GET',
          path: '/api/files/list',
          description: 'แสดงรายการไฟล์และโฟลเดอร์',
          auth: 'Cookie',
          body: { folderId: 'number? (ID โฟลเดอร์ parent)' },
          response: {
            success: true,
            data: {
              files: ['{ id, name, size, mime_type, is_public }'],
              folders: ['{ id, name, parent_id }']
            }
          }
        },
        {
          method: 'POST',
          path: '/api/files/share',
          description: 'สร้าง/ยกเลิก Public Link',
          auth: 'Cookie',
          body: {
            fileId: 'number',
            isPublic: 'boolean'
          },
          response: {
            success: true,
            data: { public_url: 'uuid-string หรือ null' }
          }
        },
        {
          method: 'POST',
          path: '/api/files/move',
          description: 'ย้ายไฟล์ไปโฟลเดอร์อื่น',
          auth: 'Cookie',
          body: {
            fileId: 'number',
            targetFolderId: 'number | null'
          },
          response: { success: true, message: 'ย้ายไฟล์สำเร็จ' }
        }
      ]
    },
    folders: {
      title: 'Folders Management (Web Only)',
      icon: <FolderPlus className="w-5 h-5" />,
      endpoints: [
        {
          method: 'POST',
          path: '/api/folders/create',
          description: 'สร้างโฟลเดอร์ใหม่',
          auth: 'Cookie',
          body: {
            name: 'string (ชื่อโฟลเดอร์)',
            parentId: 'number? (ID โฟลเดอร์ parent)'
          },
          response: {
            success: true,
            data: { id: 1, name: 'My Folder', path: '/My Folder' }
          }
        },
        {
          method: 'DELETE',
          path: '/api/folders/delete/:id',
          description: 'ลบโฟลเดอร์ (รวมไฟล์ภายใน)',
          auth: 'Cookie',
          response: { success: true, message: 'ลบโฟลเดอร์สำเร็จ' }
        },
        {
          method: 'GET',
          path: '/api/folders/list',
          description: 'แสดงรายการโฟลเดอร์',
          auth: 'Cookie',
          body: { parentId: 'number? (ID โฟลเดอร์ parent)' },
          response: {
            success: true,
            data: ['{ id, name, parent_id, path }']
          }
        }
      ]
    },
    apikeys: {
      title: 'API Keys Management (Web Only)',
      icon: <Key className="w-5 h-5" />,
      endpoints: [
        {
          method: 'POST',
          path: '/api/apikeys/generate',
          description: 'สร้าง API Key ใหม่',
          auth: 'Cookie',
          body: {
            name: 'string (ชื่อ key)',
            permissions: {
              upload: 'boolean',
              download: 'boolean',
              delete: 'boolean',
              list: 'boolean',
              createFolder: 'boolean',
              deleteFolder: 'boolean'
            },
            expiresIn: 'number? (วันที่หมดอายุ)'
          },
          response: {
            success: true,
            data: {
              key: 'cv_xxxxxxxxxxxxxxxxxxxx',
              id: 1
            }
          }
        },
        {
          method: 'GET',
          path: '/api/apikeys/list',
          description: 'แสดงรายการ API Keys',
          auth: 'Cookie',
          response: {
            success: true,
            data: ['{ id, name, key_prefix, permissions, is_active, expires_at }']
          }
        },
        {
          method: 'DELETE',
          path: '/api/apikeys/revoke/:id',
          description: 'ลบ API Key',
          auth: 'Cookie'
        },
        {
          method: 'PATCH',
          path: '/api/apikeys/revoke/:id',
          description: 'เปิด/ปิดใช้งาน API Key',
          auth: 'Cookie',
          body: { is_active: 'boolean' }
        }
      ]
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Book className="w-6 h-6 text-blue-400" />
            API Documentation
          </h1>
          <p className="text-gray-400 mt-1">คู่มือการใช้งาน Cloud Storage API</p>
        </div>
      </div>

      {/* Base URL Setting */}
      <div className="glass rounded-xl p-4">
        <label className="block text-sm font-medium mb-2">Base URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={baseUrl}
            readOnly
            className="input flex-1 bg-gray-800/80"
            placeholder="https://your-domain.com"
          />
          <button
            onClick={() => copyToClipboard(baseUrl)}
            className="btn-secondary"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Authentication Info */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-yellow-400" />
          การ Authentication
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="font-medium text-green-400 mb-2">🔐 Cookie Auth (Web)</h3>
            <p className="text-sm text-gray-400">
              สำหรับใช้งานผ่าน Web Browser หลังจาก Login ระบบจะ set cookie อัตโนมัติ
              (ใช้ได้เฉพาะบน Website เท่านั้น)
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="font-medium text-blue-400 mb-2">🔑 API Key (External)</h3>
            <p className="text-sm text-gray-400 mb-2">
              สำหรับเชื่อมต่อจากระบบภายนอก ส่ง API Key ผ่าน Header:
            </p>
            <code className="block bg-gray-900 px-3 py-2 rounded text-xs">
              X-API-Key: cv_your_api_key_here
            </code>
          </div>
        </div>
      </div>

      {/* Rate Limits */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-400" />
          ข้อจำกัดและข้อมูลสำคัญ
        </h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {process.env.NEXT_PUBLIC_MAX_STORAGE_GB || '50'} GB
            </div>
            <p className="text-gray-400">พื้นที่จัดเก็บต่อผู้ใช้</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className={`text-2xl font-bold mb-1 ${isFileSizeUnlimited ? 'text-green-400' : 'text-yellow-400'}`}>
              {formatMaxFileSize()}
            </div>
            <p className="text-gray-400">ขนาดไฟล์สูงสุดต่อไฟล์</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400 mb-1">∞</div>
            <p className="text-gray-400">ไม่จำกัดจำนวน API Requests</p>
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="space-y-4">
        {Object.entries(endpointGroups).map(([key, group]) => (
          <div key={key} className="glass rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection(key)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-blue-400">{group.icon}</span>
                <span className="font-bold">{group.title}</span>
                <span className="badge badge-secondary text-xs">
                  {group.endpoints.length} endpoints
                </span>
              </div>
              {expandedSections.includes(key) ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedSections.includes(key) && (
              <div className="border-t border-gray-700/50">
                {group.endpoints.map((endpoint, idx) => (
                  <div
                    key={idx}
                    className="border-b border-gray-700/50 last:border-b-0"
                  >
                    <button
                      onClick={() =>
                        setActiveEndpoint(
                          activeEndpoint === `${key}-${idx}` ? null : `${key}-${idx}`
                        )
                      }
                      className="w-full p-4 hover:bg-gray-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-mono font-bold border ${
                            methodColors[endpoint.method]
                          }`}
                        >
                          {endpoint.method}
                        </span>
                        <code className="text-sm font-mono">{endpoint.path}</code>
                        <span className="text-gray-400 text-sm hidden sm:inline">
                          — {endpoint.description}
                        </span>
                        <span className={`ml-auto badge text-xs ${
                          endpoint.auth === 'API Key' ? 'badge-warning' :
                          endpoint.auth === 'Cookie' ? 'badge-info' : 'badge-secondary'
                        }`}>
                          {endpoint.auth}
                        </span>
                      </div>
                    </button>

                    {activeEndpoint === `${key}-${idx}` && (
                      <div className="px-4 pb-4 space-y-4 bg-gray-900/50">
                        <p className="text-gray-300 sm:hidden">{endpoint.description}</p>

                        {endpoint.headers && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Headers:</h4>
                            <pre className="bg-gray-800 rounded-lg p-3 text-sm overflow-x-auto">
                              {JSON.stringify(endpoint.headers, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.body && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Request Body:</h4>
                            <pre className="bg-gray-800 rounded-lg p-3 text-sm overflow-x-auto">
                              {JSON.stringify(endpoint.body, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.response && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Response:</h4>
                            <pre className="bg-gray-800 rounded-lg p-3 text-sm overflow-x-auto">
                              {JSON.stringify(endpoint.response, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.example && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-400">ตัวอย่างการใช้งาน:</h4>
                              <button
                                onClick={() => copyToClipboard(endpoint.example!)}
                                className="text-xs text-blue-400 hover:text-indigo-300 flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                คัดลอก
                              </button>
                            </div>
                            <pre className="bg-gray-800 rounded-lg p-3 text-sm overflow-x-auto whitespace-pre-wrap">
                              {endpoint.example}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Code Examples */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-green-400" />
          ตัวอย่าง Integration
        </h2>

        <div className="space-y-4">
          {/* Node.js Example */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-yellow-400">Node.js / JavaScript</h3>
              <button
                onClick={() => copyToClipboard(`const API_KEY = 'cv_your_api_key_here';
const BASE_URL = '${baseUrl}';

// Upload file
async function uploadFile(filePath) {
  const FormData = require('form-data');
  const fs = require('fs');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  const response = await fetch(\`\${BASE_URL}/api/public/upload\`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY },
    body: form
  });
  
  return response.json();
}

// List files
async function listFiles(folderId = null) {
  const url = folderId 
    ? \`\${BASE_URL}/api/public/list?folderId=\${folderId}\`
    : \`\${BASE_URL}/api/public/list\`;
    
  const response = await fetch(url, {
    headers: { 'X-API-Key': API_KEY }
  });
  
  return response.json();
}

// Download file
async function downloadFile(fileId, outputPath) {
  const response = await fetch(\`\${BASE_URL}/api/public/download/\${fileId}\`, {
    headers: { 'X-API-Key': API_KEY }
  });
  
  const fs = require('fs');
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}`)}
                className="text-xs text-blue-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                คัดลอก
              </button>
            </div>
            <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`const API_KEY = 'cv_your_api_key_here';
const BASE_URL = '${baseUrl}';

// Upload file
async function uploadFile(filePath) {
  const FormData = require('form-data');
  const fs = require('fs');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  const response = await fetch(\`\${BASE_URL}/api/public/upload\`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY },
    body: form
  });
  
  return response.json();
}

// List files
async function listFiles(folderId = null) {
  const url = folderId 
    ? \`\${BASE_URL}/api/public/list?folderId=\${folderId}\`
    : \`\${BASE_URL}/api/public/list\`;
    
  const response = await fetch(url, {
    headers: { 'X-API-Key': API_KEY }
  });
  
  return response.json();
}`}
            </pre>
          </div>

          {/* Python Example */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-blue-400">Python</h3>
              <button
                onClick={() => copyToClipboard(`import requests

API_KEY = 'cv_your_api_key_here'
BASE_URL = '${baseUrl}'

headers = {'X-API-Key': API_KEY}

# Upload file
def upload_file(file_path, folder_id=None):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'folderId': folder_id} if folder_id else {}
        response = requests.post(
            f'{BASE_URL}/api/public/upload',
            headers=headers,
            files=files,
            data=data
        )
    return response.json()

# List files
def list_files(folder_id=None):
    params = {'folderId': folder_id} if folder_id else {}
    response = requests.get(
        f'{BASE_URL}/api/public/list',
        headers=headers,
        params=params
    )
    return response.json()

# Download file
def download_file(file_id, output_path):
    response = requests.get(
        f'{BASE_URL}/api/public/download/{file_id}',
        headers=headers
    )
    with open(output_path, 'wb') as f:
        f.write(response.content)`)}
                className="text-xs text-blue-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                คัดลอก
              </button>
            </div>
            <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`import requests

API_KEY = 'cv_your_api_key_here'
BASE_URL = '${baseUrl}'

headers = {'X-API-Key': API_KEY}

# Upload file
def upload_file(file_path, folder_id=None):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'folderId': folder_id} if folder_id else {}
        response = requests.post(
            f'{BASE_URL}/api/public/upload',
            headers=headers,
            files=files,
            data=data
        )
    return response.json()

# List files  
def list_files(folder_id=None):
    params = {'folderId': folder_id} if folder_id else {}
    response = requests.get(
        f'{BASE_URL}/api/public/list',
        headers=headers,
        params=params
    )
    return response.json()`}
            </pre>
          </div>

          {/* cURL Example */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-purple-400">cURL</h3>
            </div>
            <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`# Upload file
curl -X POST ${baseUrl}/api/public/upload \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -F "file=@./myfile.jpg"

# List files
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${baseUrl}/api/public/list"

# Download file
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${baseUrl}/api/public/download/123" -o output.jpg

# Delete file
curl -X DELETE -H "X-API-Key: cv_your_api_key_here" \\
  "${baseUrl}/api/public/delete/123"

# Create folder
curl -X POST ${baseUrl}/api/public/folders/create \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Folder"}'`}
            </pre>
          </div>
        </div>
      </div>

      {/* Error Codes */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          Error Codes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left p-3">Status Code</th>
                <th className="text-left p-3">ความหมาย</th>
                <th className="text-left p-3">วิธีแก้ไข</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              <tr>
                <td className="p-3"><code className="text-red-400">400</code></td>
                <td className="p-3">Bad Request</td>
                <td className="p-3 text-gray-400">ตรวจสอบ request body/parameters</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-yellow-400">401</code></td>
                <td className="p-3">Unauthorized</td>
                <td className="p-3 text-gray-400">ตรวจสอบ API Key หรือ Login ใหม่</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-orange-400">403</code></td>
                <td className="p-3">Forbidden</td>
                <td className="p-3 text-gray-400">API Key ไม่มีสิทธิ์เข้าถึง endpoint นี้</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-blue-400">404</code></td>
                <td className="p-3">Not Found</td>
                <td className="p-3 text-gray-400">ไฟล์/โฟลเดอร์ไม่พบ</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-purple-400">413</code></td>
                <td className="p-3">Payload Too Large</td>
                <td className="p-3 text-gray-400">
                  {isFileSizeUnlimited 
                    ? 'ไฟล์ใหญ่เกินไป (ไม่มีข้อจำกัดที่ตั้งไว้ แต่อาจถูกจำกัดโดย server)'
                    : `ไฟล์ใหญ่เกินกำหนด (${formatMaxFileSize()})`
                  }
                </td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-pink-400">507</code></td>
                <td className="p-3">Insufficient Storage</td>
                <td className="p-3 text-gray-400">พื้นที่เก็บข้อมูลเต็ม ลบไฟล์เก่าหรือติดต่อ Admin</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-red-500">500</code></td>
                <td className="p-3">Server Error</td>
                <td className="p-3 text-gray-400">ติดต่อ Admin หรือลองใหม่อีกครั้ง</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}