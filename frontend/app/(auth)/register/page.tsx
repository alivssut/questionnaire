'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';

import { RegisterForm } from '@/features/auth/components/register-form';
import { useAuth } from '@/shared/providers/auth-provider';
import { PageLoader } from '@/shared/components/ui/spinner';

function RegisterContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

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
            ساخت پرسشنامه حرفه‌ای،
            <br />
            در کمتر از ۵ دقیقه.
          </blockquote>

          <ul className="space-y-4">
            {[
              '۲۲ نوع سوال متنوع',
              'تحلیل لحظه‌ای پاسخ‌ها',
              'پشتیبانی کامل از فارسی و RTL',
              'پاسخ‌های ناشناس',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-white/90">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px]">✓</span>
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-white/40 text-sm">© ۱۴۰۴ FORMly</p>
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

          <h1 className="text-2xl font-bold mb-1.5">ایجاد حساب کاربری</h1>
          <p className="text-muted-foreground text-sm mb-8">
            برای شروع، اطلاعات خود را وارد کنید.
          </p>

          <RegisterForm />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            قبلاً ثبت‌نام کرده‌اید؟{' '}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              وارد شوید
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RegisterContent />
    </Suspense>
  );
}