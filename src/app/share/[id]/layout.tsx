import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'แชร์ไฟล์ - CloudVault',
  description: 'ดูและดาวน์โหลดไฟล์ที่แชร์',
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
