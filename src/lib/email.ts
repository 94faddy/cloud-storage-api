import nodemailer from 'nodemailer';

// ============================================
// 🔧 ตั้งค่า SMTP Transporter
// ============================================
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.pix9.my',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// ============================================
// 🧪 ทดสอบ SMTP Connection
// ============================================
export const testSMTPConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true, message: 'SMTP connection successful' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// ============================================
// 📧 EMAIL 1: ยืนยันอีเมล (สมัครสมาชิก)
// ============================================
export const sendVerificationEmail = async (
  to: string,
  username: string,
  token: string
): Promise<boolean> => {
  const transporter = createTransporter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cloud.pix9.my';
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CloudVault';
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  // 🎨 แก้ไข HTML Template ด้านล่างนี้
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden;">
          
          <!-- 🎨 HEADER: แก้ไขสีพื้นหลัง gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 40px; text-align: center;">
              <!-- 🎨 แก้ไขชื่อแอพ/โลโก้ -->
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">☁️ ${appName}</h1>
              <!-- 🎨 แก้ไข Tagline -->
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Cloud Storage ส่วนตัวของคุณ</p>
            </td>
          </tr>
          
          <!-- CONTENT -->
          <tr>
            <td style="padding: 40px;">
              <!-- 🎨 แก้ไขคำทักทาย -->
              <h2 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 24px;">สวัสดี ${username}! 👋</h2>
              
              <!-- 🎨 แก้ไขข้อความหลัก -->
              <p style="margin: 0 0 25px 0; color: #94a3b8; font-size: 16px; line-height: 1.6;">
                ขอบคุณที่สมัครสมาชิก ${appName}! กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณและเริ่มใช้งาน Cloud Storage
              </p>
              
              <!-- 🎨 BUTTON: แก้ไขสีปุ่มและข้อความ -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      ✉️ ยืนยันอีเมล
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- 🎨 แก้ไขข้อความลิงก์สำรอง -->
              <p style="margin: 25px 0 15px 0; color: #64748b; font-size: 14px;">หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:</p>
              <div style="background-color: #0f172a; padding: 15px; border-radius: 8px; word-break: break-all;">
                <a href="${verifyUrl}" style="color: #60a5fa; font-size: 13px; text-decoration: none;">${verifyUrl}</a>
              </div>
              
              <!-- 🎨 WARNING: แก้ไขข้อความเตือนและเวลาหมดอายุ -->
              <div style="margin-top: 30px; padding: 15px; background-color: rgba(251, 191, 36, 0.1); border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0; color: #fbbf24; font-size: 14px;">⚠️ ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง</p>
              </div>
            </td>
          </tr>
          
          <!-- 🎨 FOOTER: แก้ไขข้อความ footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 30px 40px; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 13px;">หากคุณไม่ได้สมัครสมาชิก กรุณาเพิกเฉยอีเมลนี้</p>
              <p style="margin: 0; color: #475569; font-size: 12px;">© 2025 ${appName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || appName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      // 🎨 แก้ไขหัวข้อ Email
      subject: `✉️ ยืนยันอีเมลของคุณ - ${appName}`,
      html: htmlContent,
    });
    console.log(`Verification email sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send verification email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// ============================================
// 📧 EMAIL 2: รีเซ็ตรหัสผ่าน (ลืมรหัสผ่าน)
// ============================================
export const sendPasswordResetEmail = async (
  to: string,
  username: string,
  token: string
): Promise<boolean> => {
  const transporter = createTransporter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cloud.pix9.my';
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CloudVault';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  // 🎨 แก้ไข HTML Template ด้านล่างนี้
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden;">
          
          <!-- 🎨 HEADER: สีแดง-ส้ม สำหรับ warning -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 40px; text-align: center;">
              <!-- 🎨 แก้ไขหัวเรื่อง -->
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🔐 รีเซ็ตรหัสผ่าน</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${appName}</p>
            </td>
          </tr>
          
          <!-- CONTENT -->
          <tr>
            <td style="padding: 40px;">
              <!-- 🎨 แก้ไขคำทักทาย -->
              <h2 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 24px;">สวัสดี ${username}</h2>
              
              <!-- 🎨 แก้ไขข้อความหลัก -->
              <p style="margin: 0 0 25px 0; color: #94a3b8; font-size: 16px; line-height: 1.6;">
                เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
              </p>
              
              <!-- 🎨 BUTTON: แก้ไขสีปุ่มและข้อความ -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      🔑 รีเซ็ตรหัสผ่าน
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- 🎨 แก้ไขข้อความลิงก์สำรอง -->
              <p style="margin: 25px 0 15px 0; color: #64748b; font-size: 14px;">หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:</p>
              <div style="background-color: #0f172a; padding: 15px; border-radius: 8px; word-break: break-all;">
                <a href="${resetUrl}" style="color: #60a5fa; font-size: 13px; text-decoration: none;">${resetUrl}</a>
              </div>
              
              <!-- 🎨 WARNING: แก้ไขข้อความเตือน -->
              <div style="margin-top: 30px; padding: 15px; background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 4px;">
                <p style="margin: 0; color: #f87171; font-size: 14px;">⚠️ ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง</p>
                <p style="margin: 10px 0 0 0; color: #f87171; font-size: 14px;">หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้</p>
              </div>
            </td>
          </tr>
          
          <!-- 🎨 FOOTER -->
          <tr>
            <td style="background-color: #0f172a; padding: 30px 40px; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0; color: #475569; font-size: 12px;">© 2025 ${appName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || appName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      // 🎨 แก้ไขหัวข้อ Email
      subject: `🔐 รีเซ็ตรหัสผ่าน - ${appName}`,
      html: htmlContent,
    });
    console.log(`Password reset email sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send password reset email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// ============================================
// 📧 EMAIL 3: ทดสอบ SMTP (Admin)
// ============================================
export const sendTestEmail = async (to: string): Promise<boolean> => {
  const transporter = createTransporter();
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CloudVault';

  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || appName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: `✅ ทดสอบ SMTP - ${appName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 30px; background: #1e293b; color: #fff; border-radius: 12px; max-width: 500px;">
          <h2 style="color: #22c55e; margin: 0 0 15px 0;">✅ SMTP ทำงานปกติ!</h2>
          <p style="color: #94a3b8; margin: 0 0 10px 0;">นี่คืออีเมลทดสอบจาก ${appName}</p>
          <p style="color: #64748b; margin: 0; font-size: 14px;">เวลา: ${new Date().toLocaleString('th-TH')}</p>
        </div>
      `,
    });
    return true;
  } catch (error: any) {
    console.error('Failed to send test email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};