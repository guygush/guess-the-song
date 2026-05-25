import type { Metadata, Viewport } from 'next';
import { Varela_Round } from 'next/font/google';
import './globals.css';

const varelaRound = Varela_Round({ weight: '400', subsets: ['latin', 'hebrew'] });

export const metadata: Metadata = {
  title: 'צפוף',
  description: 'משחקי מוזיקה וניחושים',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'צפוף',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#fcf8e8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={varelaRound.className}>{children}</body>
    </html>
  );
}
