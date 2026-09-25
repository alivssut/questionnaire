import type { Metadata } from 'next';
import { Providers } from '@/shared/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'FORMly — پلتفرم نظرسنجی و پرسشنامه',
  description: 'ساخت، توزیع و تحلیل پرسشنامه‌های حرفه‌ای',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}