/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  experimental: {
    serverComponentsExternalPackages: ['mysql2'],
  },

  // ============================================
  // 🔧 สำคัญ: เพิ่ม body size limit สำหรับไฟล์ใหญ่
  // ============================================
  api: {
    bodyParser: {
      sizeLimit: '100gb',
    },
    responseLimit: false,
  },

  // สำหรับ App Router (Next.js 14+)
  serverActions: {
    bodySizeLimit: '100gb',
  },

  // เพิ่ม timeout สำหรับ static generation
  staticPageGenerationTimeout: 600,

  // ปิด compression เพื่อลด memory usage
  compress: false,

  // Output standalone สำหรับ production
  output: 'standalone',
}

module.exports = nextConfig