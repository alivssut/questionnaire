'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to your monitoring service (Sentry, etc.)
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-destructive/5 via-background to-amber-500/5">
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={36} className="text-destructive" />
        </div>

        <h1 className="text-2xl font-bold mb-3">مشکلی پیش آمد</h1>
        <p className="text-muted-foreground mb-2 leading-relaxed">
          متأسفانه در پردازش درخواست شما خطایی رخ داد.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70 font-mono mb-6">
            کد خطا: {error.digest}
          </p>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          <Button onClick={() => reset()}>
            <RotateCw size={16} /> تلاش مجدد
          </Button>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            <Home size={16} /> داشبورد
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-8 text-right">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              جزئیات خطا (فقط در توسعه)
            </summary>
            <pre className="mt-3 p-4 bg-muted rounded-xl text-[11px] text-left overflow-auto max-h-64">
              {error.stack || error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}