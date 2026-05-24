import type { Metadata, Viewport } from 'next';
import { Varela_Round } from 'next/font/google';
import './globals.css';

const varelaRound = Varela_Round({ weight: '400', subsets: ['latin', 'hebrew'] });

export const metadata: Metadata = {
  title: 'נחש את השיר',
  description: 'כמה תווים אתה צריך?',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'נחש את השיר',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#4F46E5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={varelaRound.className}>{children}</body>
    </html>
  );
}
