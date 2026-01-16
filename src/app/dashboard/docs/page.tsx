'use client';

import { useState } from 'react';
import { Book, Copy, ChevronDown, ChevronRight, Code, Upload, Download, Trash2, FolderPlus, List, Key, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import Swal from 'sweetalert2';

interface Endpoint {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: 'API Key' | 'None';
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
  const [expandedSections, setExpandedSections] = useState<string[]>(['public']);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  
  // ใช้ API URL จาก env
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://apiv1.nexzcloud.lol';

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
            folderId: 'number? (ID โฟลเดอร์, optional)'
          },
          response: {
            success: true,
            data: {
              uploaded: [{
                id: 1,
                filename: 'abc123.jpg',
                originalName: 'photo.jpg',
                size: 1024000,
                mimeType: 'image/jpeg',
                path: 'user_1/abc123.jpg',
                url: '/api/public/download/1'
              }],
              errors: []
            },
            message: '1 file(s) uploaded successfully'
          },
          example: `// Node.js Example
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('./photo.jpg'));
// Optional: ระบุ folder
form.append('folderId', '1');

fetch('${apiUrl}/api/public/upload', {
  method: 'POST',
  headers: {
    'X-API-Key': 'cv_your_api_key_here'
  },
  body: form
});

// cURL Example
curl -X POST ${apiUrl}/api/public/upload \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -F "file=@./photo.jpg" \\
  -F "folderId=1"`
        },
        {
          method: 'GET',
          path: '/api/public/download/:id',
          description: 'ดาวน์โหลดไฟล์ (ใช้ File ID หรือ Public UUID)',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          response: { type: 'Binary file stream (รองรับ Range requests สำหรับ resume download)' },
          example: `// Download by File ID (ต้องใช้ API Key)
fetch('${apiUrl}/api/public/download/123', {
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});

// Download by Public UUID (ไม่ต้องใช้ API Key - สำหรับไฟล์ที่ share แล้ว)
fetch('${apiUrl}/api/public/download/abc123-uuid-here');

// Resume Download (รองรับ Range header)
fetch('${apiUrl}/api/public/download/123', {
  headers: { 
    'X-API-Key': 'cv_your_api_key_here',
    'Range': 'bytes=1000-'
  }
});

// cURL
curl -H "X-API-Key: cv_your_api_key_here" \\
  ${apiUrl}/api/public/download/123 -o file.jpg

# Resume download
curl -H "X-API-Key: cv_your_api_key_here" \\
  -H "Range: bytes=1000-" \\
  ${apiUrl}/api/public/download/123 -o file.jpg`
        },
        {
          method: 'GET',
          path: '/api/public/list',
          description: 'แสดงรายการไฟล์และโฟลเดอร์',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          body: { folderId: 'number? (ID โฟลเดอร์, optional - ถ้าไม่ระบุจะแสดง root)' },
          response: {
            success: true,
            data: {
              files: [{
                id: 1,
                name: 'abc123.jpg',
                original_name: 'photo.jpg',
                mime_type: 'image/jpeg',
                size: 1024000,
                is_public: false,
                public_url: null,
                created_at: '2025-01-17T10:00:00Z'
              }],
              folders: [{
                id: 1,
                name: 'My Folder',
                path: 'My Folder',
                is_public: false,
                public_url: null
              }]
            }
          },
          example: `// List root directory
fetch('${apiUrl}/api/public/list', {
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});

// List specific folder
fetch('${apiUrl}/api/public/list?folderId=1', {
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});

// cURL
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/list?folderId=1"`
        },
        {
          method: 'DELETE',
          path: '/api/public/delete/:id',
          description: 'ลบไฟล์',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          response: { 
            success: true, 
            message: 'File deleted successfully' 
          },
          example: `fetch('${apiUrl}/api/public/delete/123', {
  method: 'DELETE',
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});

// cURL
curl -X DELETE -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/delete/123"`
        },
        {
          method: 'POST',
          path: '/api/public/folders/create',
          description: 'สร้างโฟลเดอร์ใหม่',
          auth: 'API Key',
          headers: { 
            'X-API-Key': 'cv_your_api_key_here',
            'Content-Type': 'application/json'
          },
          body: {
            name: 'string (ชื่อโฟลเดอร์)',
            parentId: 'number? (ID โฟลเดอร์ parent, optional)'
          },
          response: {
            success: true,
            data: { 
              id: 1, 
              name: 'My Folder', 
              path: 'My Folder',
              parent_id: null,
              is_public: false
            },
            message: 'Folder created successfully'
          },
          example: `// Create folder at root
fetch('${apiUrl}/api/public/folders/create', {
  method: 'POST',
  headers: { 
    'X-API-Key': 'cv_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Folder'
  })
});

// Create subfolder
fetch('${apiUrl}/api/public/folders/create', {
  method: 'POST',
  headers: { 
    'X-API-Key': 'cv_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Subfolder',
    parentId: 1
  })
});

// cURL
curl -X POST ${apiUrl}/api/public/folders/create \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Folder", "parentId": null}'`
        },
        {
          method: 'DELETE',
          path: '/api/public/folders/delete/:id',
          description: 'ลบโฟลเดอร์ (รวมไฟล์และโฟลเดอร์ย่อยภายในทั้งหมด)',
          auth: 'API Key',
          headers: { 'X-API-Key': 'cv_your_api_key_here' },
          response: { 
            success: true, 
            message: 'Folder deleted successfully' 
          },
          example: `fetch('${apiUrl}/api/public/folders/delete/1', {
  method: 'DELETE',
  headers: { 'X-API-Key': 'cv_your_api_key_here' }
});

// cURL
curl -X DELETE -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/folders/delete/1"`
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
          <p className="text-gray-400 mt-1">คู่มือการใช้งาน NexzCloud API สำหรับเชื่อมต่อภายนอก</p>
        </div>
      </div>

      {/* Base URL Setting */}
      <div className="glass rounded-xl p-4">
        <label className="block text-sm font-medium mb-2">🌐 API Base URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={apiUrl}
            readOnly
            className="input flex-1 bg-gray-800/80 font-mono"
          />
          <button
            onClick={() => copyToClipboard(apiUrl)}
            className="btn-secondary"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">* ใช้ URL นี้สำหรับเรียก API ทั้งหมด</p>
      </div>

      {/* Authentication Info */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-yellow-400" />
          การ Authentication
        </h2>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="font-medium text-blue-400 mb-3">🔑 API Key Authentication</h3>
          <p className="text-sm text-gray-400 mb-3">
            ส่ง API Key ผ่าน Header <code className="bg-gray-900 px-2 py-1 rounded text-blue-300">X-API-Key</code> ในทุก Request
          </p>
          <div className="bg-gray-900 rounded-lg p-3">
            <code className="text-sm text-green-400">X-API-Key: cv_your_api_key_here</code>
          </div>
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              💡 <strong>วิธีสร้าง API Key:</strong> ไปที่หน้า <a href="/dashboard/apikeys" className="underline hover:text-blue-200">API Keys</a> แล้วกด "สร้าง API Key ใหม่"
            </p>
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
                        <span className="ml-auto badge badge-warning text-xs">
                          {endpoint.auth}
                        </span>
                      </div>
                    </button>

                    {activeEndpoint === `${key}-${idx}` && (
                      <div className="px-4 pb-4 space-y-4 bg-gray-900/50">
                        <p className="text-gray-300 sm:hidden">{endpoint.description}</p>

                        {endpoint.headers && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">📋 Headers:</h4>
                            <pre className="bg-gray-800 rounded-lg p-3 text-sm overflow-x-auto">
                              {JSON.stringify(endpoint.headers, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.body && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">📤 Request Body / Query Parameters:</h4>
                            <pre className="bg-gray-800 rounded-lg p-3 text-sm overflow-x-auto">
                              {JSON.stringify(endpoint.body, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.response && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">📥 Response:</h4>
                            <pre className="bg-gray-800 rounded-lg p-3 text-sm overflow-x-auto">
                              {JSON.stringify(endpoint.response, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.example && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-400">💻 ตัวอย่างการใช้งาน:</h4>
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
              <h3 className="font-medium text-yellow-400">📦 Node.js / JavaScript</h3>
              <button
                onClick={() => copyToClipboard(`const API_KEY = 'cv_your_api_key_here';
const BASE_URL = '${apiUrl}';

const headers = { 'X-API-Key': API_KEY };

// Upload file
async function uploadFile(filePath, folderId = null) {
  const FormData = require('form-data');
  const fs = require('fs');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  if (folderId) form.append('folderId', folderId.toString());
  
  const response = await fetch(\`\${BASE_URL}/api/public/upload\`, {
    method: 'POST',
    headers: { ...headers },
    body: form
  });
  
  return response.json();
}

// List files
async function listFiles(folderId = null) {
  const url = folderId 
    ? \`\${BASE_URL}/api/public/list?folderId=\${folderId}\`
    : \`\${BASE_URL}/api/public/list\`;
    
  const response = await fetch(url, { headers });
  return response.json();
}

// Download file
async function downloadFile(fileId, outputPath) {
  const fs = require('fs');
  const response = await fetch(\`\${BASE_URL}/api/public/download/\${fileId}\`, { headers });
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// Delete file
async function deleteFile(fileId) {
  const response = await fetch(\`\${BASE_URL}/api/public/delete/\${fileId}\`, {
    method: 'DELETE',
    headers
  });
  return response.json();
}

// Create folder
async function createFolder(name, parentId = null) {
  const response = await fetch(\`\${BASE_URL}/api/public/folders/create\`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId })
  });
  return response.json();
}

// Delete folder
async function deleteFolder(folderId) {
  const response = await fetch(\`\${BASE_URL}/api/public/folders/delete/\${folderId}\`, {
    method: 'DELETE',
    headers
  });
  return response.json();
}`)}
                className="text-xs text-blue-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                คัดลอก
              </button>
            </div>
            <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto max-h-96">
{`const API_KEY = 'cv_your_api_key_here';
const BASE_URL = '${apiUrl}';

const headers = { 'X-API-Key': API_KEY };

// Upload file
async function uploadFile(filePath, folderId = null) {
  const FormData = require('form-data');
  const fs = require('fs');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  if (folderId) form.append('folderId', folderId.toString());
  
  const response = await fetch(\`\${BASE_URL}/api/public/upload\`, {
    method: 'POST',
    headers: { ...headers },
    body: form
  });
  
  return response.json();
}

// List files
async function listFiles(folderId = null) {
  const url = folderId 
    ? \`\${BASE_URL}/api/public/list?folderId=\${folderId}\`
    : \`\${BASE_URL}/api/public/list\`;
    
  const response = await fetch(url, { headers });
  return response.json();
}

// Download file
async function downloadFile(fileId, outputPath) {
  const fs = require('fs');
  const response = await fetch(
    \`\${BASE_URL}/api/public/download/\${fileId}\`, 
    { headers }
  );
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// Delete file
async function deleteFile(fileId) {
  const response = await fetch(
    \`\${BASE_URL}/api/public/delete/\${fileId}\`, 
    { method: 'DELETE', headers }
  );
  return response.json();
}

// Create folder
async function createFolder(name, parentId = null) {
  const response = await fetch(\`\${BASE_URL}/api/public/folders/create\`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId })
  });
  return response.json();
}`}
            </pre>
          </div>

          {/* Python Example */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-blue-400">🐍 Python</h3>
              <button
                onClick={() => copyToClipboard(`import requests

API_KEY = 'cv_your_api_key_here'
BASE_URL = '${apiUrl}'

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
        f.write(response.content)

# Delete file
def delete_file(file_id):
    response = requests.delete(
        f'{BASE_URL}/api/public/delete/{file_id}',
        headers=headers
    )
    return response.json()

# Create folder
def create_folder(name, parent_id=None):
    response = requests.post(
        f'{BASE_URL}/api/public/folders/create',
        headers={**headers, 'Content-Type': 'application/json'},
        json={'name': name, 'parentId': parent_id}
    )
    return response.json()

# Delete folder  
def delete_folder(folder_id):
    response = requests.delete(
        f'{BASE_URL}/api/public/folders/delete/{folder_id}',
        headers=headers
    )
    return response.json()`)}
                className="text-xs text-blue-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                คัดลอก
              </button>
            </div>
            <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto max-h-96">
{`import requests

API_KEY = 'cv_your_api_key_here'
BASE_URL = '${apiUrl}'

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
        f.write(response.content)

# Delete file
def delete_file(file_id):
    response = requests.delete(
        f'{BASE_URL}/api/public/delete/{file_id}',
        headers=headers
    )
    return response.json()

# Create folder
def create_folder(name, parent_id=None):
    response = requests.post(
        f'{BASE_URL}/api/public/folders/create',
        headers={**headers, 'Content-Type': 'application/json'},
        json={'name': name, 'parentId': parent_id}
    )
    return response.json()`}
            </pre>
          </div>

          {/* cURL Example */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-purple-400">🔧 cURL</h3>
              <button
                onClick={() => copyToClipboard(`# Upload file
curl -X POST ${apiUrl}/api/public/upload \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -F "file=@./myfile.jpg" \\
  -F "folderId=1"

# List files (root)
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/list"

# List files in folder
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/list?folderId=1"

# Download file
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/download/123" -o output.jpg

# Delete file
curl -X DELETE -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/delete/123"

# Create folder
curl -X POST ${apiUrl}/api/public/folders/create \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Folder", "parentId": null}'

# Delete folder
curl -X DELETE -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/folders/delete/1"`)}
                className="text-xs text-blue-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                คัดลอก
              </button>
            </div>
            <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`# Upload file
curl -X POST ${apiUrl}/api/public/upload \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -F "file=@./myfile.jpg" \\
  -F "folderId=1"

# List files (root)
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/list"

# List files in folder
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/list?folderId=1"

# Download file
curl -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/download/123" -o output.jpg

# Delete file
curl -X DELETE -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/delete/123"

# Create folder
curl -X POST ${apiUrl}/api/public/folders/create \\
  -H "X-API-Key: cv_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Folder", "parentId": null}'

# Delete folder
curl -X DELETE -H "X-API-Key: cv_your_api_key_here" \\
  "${apiUrl}/api/public/folders/delete/1"`}
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
                <td className="p-3 text-gray-400">ตรวจสอบ request body/parameters ให้ถูกต้อง</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-yellow-400">401</code></td>
                <td className="p-3">Unauthorized</td>
                <td className="p-3 text-gray-400">ตรวจสอบ API Key ว่าถูกต้องและยังไม่หมดอายุ</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-orange-400">403</code></td>
                <td className="p-3">Forbidden</td>
                <td className="p-3 text-gray-400">API Key ไม่มีสิทธิ์เข้าถึง endpoint นี้ (ตรวจสอบ permissions)</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-blue-400">404</code></td>
                <td className="p-3">Not Found</td>
                <td className="p-3 text-gray-400">ไฟล์/โฟลเดอร์ไม่พบ หรือไม่มีสิทธิ์เข้าถึง</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-purple-400">413</code></td>
                <td className="p-3">Payload Too Large</td>
                <td className="p-3 text-gray-400">
                  {isFileSizeUnlimited 
                    ? 'ไฟล์ใหญ่เกินไป (อาจถูกจำกัดโดย server config)'
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
                <td className="p-3 text-gray-400">เกิดข้อผิดพลาดภายใน server ลองใหม่อีกครั้ง</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* API Key Permissions */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-green-400" />
          API Key Permissions
        </h2>
        <p className="text-gray-400 mb-4">เมื่อสร้าง API Key คุณสามารถกำหนดสิทธิ์การใช้งานได้ดังนี้:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left p-3">Permission</th>
                <th className="text-left p-3">คำอธิบาย</th>
                <th className="text-left p-3">Endpoints ที่ใช้ได้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              <tr>
                <td className="p-3"><code className="text-green-400">upload</code></td>
                <td className="p-3">อัพโหลดไฟล์</td>
                <td className="p-3 text-gray-400">POST /api/public/upload</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-blue-400">download</code></td>
                <td className="p-3">ดาวน์โหลดไฟล์</td>
                <td className="p-3 text-gray-400">GET /api/public/download/:id</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-yellow-400">list</code></td>
                <td className="p-3">ดูรายการไฟล์/โฟลเดอร์</td>
                <td className="p-3 text-gray-400">GET /api/public/list</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-red-400">delete</code></td>
                <td className="p-3">ลบไฟล์</td>
                <td className="p-3 text-gray-400">DELETE /api/public/delete/:id</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-purple-400">createFolder</code></td>
                <td className="p-3">สร้างโฟลเดอร์</td>
                <td className="p-3 text-gray-400">POST /api/public/folders/create</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-pink-400">deleteFolder</code></td>
                <td className="p-3">ลบโฟลเดอร์</td>
                <td className="p-3 text-gray-400">DELETE /api/public/folders/delete/:id</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}