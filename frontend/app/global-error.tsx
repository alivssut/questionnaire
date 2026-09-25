'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — catches errors in the root layout.
 * Must define its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: 'Vazirmatn, system-ui, sans-serif',
          background: '#0a0a0a',
          color: '#fafafa',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '32rem' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: 36,
            }}
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
            خطای بحرانی
          </h1>
          <p style={{ color: '#a1a1aa', marginBottom: 24, lineHeight: 1.7 }}>
            متأسفانه در بارگذاری برنامه مشکلی پیش آمد. لطفاً صفحه را دوباره بارگذاری کنید.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 24px',
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}