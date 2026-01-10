# ☁️ Cloud Storage API

ระบบ Cloud Storage API ส่วนตัว สร้างด้วย Next.js + TypeScript + MySQL

## ✨ Features

- 📁 **File Management** - อัพโหลด/ดาวน์โหลดไฟล์ทุกประเภท
- 📂 **Folder Management** - จัดการโฟลเดอร์แบบ hierarchical
- 🔑 **API Key System** - สร้าง API Key สำหรับเชื่อมต่อจากระบบภายนอก
- 🔒 **Authentication** - ระบบ Login/Register พร้อม JWT
- 📊 **Storage Quota** - กำหนดพื้นที่จัดเก็บต่อผู้ใช้ (ตั้งค่าผ่าน .env)
- 🌐 **Public Sharing** - แชร์ไฟล์เป็น Public URL
- 📖 **API Documentation** - เอกสารการใช้งาน API ในตัว
- 🎨 **Modern UI** - หน้าจัดการสวยงาม รองรับภาษาไทย

## 🚀 Quick Start

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า Database (MySQL)

สร้าง Database ใหม่:

```sql
CREATE DATABASE cloud_storage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. ตั้งค่า Environment Variables

คัดลอกไฟล์ `.env.example` เป็น `.env` และแก้ไขค่าต่างๆ:

```bash
cp .env.example .env
```

แก้ไขค่าในไฟล์ `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=cloud_storage

# JWT Secret (สร้างค่าสุ่มเอง)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Storage Settings
MAX_STORAGE_GB=50        # พื้นที่สูงสุดต่อผู้ใช้ (GB)
MAX_FILE_SIZE_MB=500     # ขนาดไฟล์สูงสุดต่อไฟล์ (MB)

# Admin Email (email นี้จะได้รับ admin rights อัตโนมัติ)
ADMIN_EMAIL=admin@example.com
```

### 4. รันระบบ

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

เปิดเว็บเบราว์เซอร์ไปที่ `http://localhost:3000`

## 📁 Project Structure

```
cloud-storage-api/
├── src/
│   ├── app/
│   │   ├── api/              # API Routes
│   │   │   ├── auth/         # Authentication APIs
│   │   │   ├── files/        # File management APIs
│   │   │   ├── folders/      # Folder management APIs
│   │   │   ├── apikeys/      # API Key management
│   │   │   ├── user/         # User profile APIs
│   │   │   └── public/       # Public API (for external access)
│   │   ├── dashboard/        # Dashboard pages
│   │   ├── login/
│   │   ├── register/
│   │   └── page.tsx          # Landing page
│   ├── components/           # React components
│   ├── lib/                  # Utilities
│   │   ├── db.ts            # Database connection
│   │   ├── auth.ts          # Authentication helpers
│   │   ├── storage.ts       # File storage helpers
│   │   └── utils.ts         # General utilities
│   └── types/               # TypeScript types
├── uploads/                  # File storage directory
├── public/                   # Static files
└── .env.example             # Environment template
```

## 🔑 API Usage

### Authentication Methods

#### 1. Cookie Auth (สำหรับ Web)
หลังจาก Login ระบบจะ set cookie อัตโนมัติ

#### 2. API Key (สำหรับ External Systems)
ส่ง API Key ผ่าน Header:
```
X-API-Key: cv_your_api_key_here
```

### Public API Endpoints

#### Upload File
```bash
curl -X POST https://your-domain.com/api/public/upload \
  -H "X-API-Key: cv_your_api_key_here" \
  -F "file=@./myfile.jpg"
```

#### List Files
```bash
curl -H "X-API-Key: cv_your_api_key_here" \
  "https://your-domain.com/api/public/list"
```

#### Download File
```bash
curl -H "X-API-Key: cv_your_api_key_here" \
  "https://your-domain.com/api/public/download/123" -o file.jpg
```

#### Delete File
```bash
curl -X DELETE -H "X-API-Key: cv_your_api_key_here" \
  "https://your-domain.com/api/public/delete/123"
```

### Node.js Integration Example

```javascript
const API_KEY = 'cv_your_api_key_here';
const BASE_URL = 'https://your-domain.com';

// Upload file
async function uploadFile(filePath) {
  const FormData = require('form-data');
  const fs = require('fs');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  const response = await fetch(`${BASE_URL}/api/public/upload`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY },
    body: form
  });
  
  return response.json();
}
```

### Python Integration Example

```python
import requests

API_KEY = 'cv_your_api_key_here'
BASE_URL = 'https://your-domain.com'

headers = {'X-API-Key': API_KEY}

# Upload file
def upload_file(file_path):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(
            f'{BASE_URL}/api/public/upload',
            headers=headers,
            files=files
        )
    return response.json()
```

## 📖 API Documentation

เข้าถึงเอกสาร API ได้ที่: `https://your-domain.com/dashboard/docs`

## 🔧 Configuration

### Storage Limits

ตั้งค่าในไฟล์ `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_STORAGE_GB` | พื้นที่สูงสุดต่อผู้ใช้ (GB) | 50 |
| `MAX_FILE_SIZE_MB` | ขนาดไฟล์สูงสุดต่อไฟล์ (MB) | 500 |

### API Key Permissions

เมื่อสร้าง API Key สามารถกำหนดสิทธิ์ได้:

- `upload` - อัพโหลดไฟล์
- `download` - ดาวน์โหลดไฟล์
- `delete` - ลบไฟล์
- `list` - ดูรายการไฟล์
- `createFolder` - สร้างโฟลเดอร์
- `deleteFolder` - ลบโฟลเดอร์

## 🛡️ Security

- Passwords ถูก hash ด้วย bcrypt (12 rounds)
- JWT Token สำหรับ authentication (7 วัน expiry)
- API Keys มีระบบ permissions และ expiration
- SQL Injection protection ด้วย parameterized queries
- File size และ storage quota enforcement

## 📝 License

MIT License

## 🙏 Credits

สร้างด้วย:
- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [MySQL](https://www.mysql.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [SweetAlert2](https://sweetalert2.github.io/)
