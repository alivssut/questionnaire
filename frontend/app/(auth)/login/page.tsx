'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Zap } from 'lucide-react';

import { LoginForm } from '@/features/auth/components/login-form';
import { useAuth } from '@/shared/providers/auth-provider';
import { PageLoader } from '@/shared/components/ui/spinner';

function LoginContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  // Redirect if already logged in
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) router.replace(next);
  }, [isAuthenticated, isLoading, next, router]);

  if (isLoading || isAuthenticated) return <PageLoader />;

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary to-purple-600 flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <Link
            href="/"
            className="text-2xl font-bold text-white tracking-tight"
          >
            FORMly
          </Link>
        </div>

        <div className="relative">
          <blockquote className="text-white/95 text-3xl font-light leading-relaxed mb-10">
            پرسشنامه‌های بهتر بسازید،
            <br />
            پاسخ‌های دقیق‌تری دریافت کنید.
          </blockquote>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'پرسشنامه', value: '۲,۸۴۷' },
              { label: 'پاسخ', value: '۱۴۲K' },
              { label: 'سازمان', value: '۳۱۸' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/10"
              >
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/60 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/40 text-sm">
          © ۱۴۰۴ FORMly. تمامی حقوق محفوظ است.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Zap size={18} className="text-primary-foreground" />
            </div>
            <Link href="/" className="text-xl font-bold tracking-tight">
              FORMly
            </Link>
          </div>

          <h1 className="text-2xl font-bold mb-1.5">خوش آمدید</h1>
          <p className="text-muted-foreground text-sm mb-8">
            برای ورود به حساب کاربری، اطلاعات خود را وارد کنید.
          </p>

          <LoginForm />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            حساب کاربری ندارید؟{' '}
            <Link
              href="/register"
              className="text-primary hover:underline font-medium"
            >
              ثبت‌نام کنید
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginContent />
    </Suspense>
  );
}