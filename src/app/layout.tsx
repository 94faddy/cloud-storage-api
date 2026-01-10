import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CloudVault - Personal Cloud Storage',
  description: 'Your personal cloud storage solution with powerful API access',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
