'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface Props {
  title?: string;
  message?: string;
  homeHref?: string;
  homeLabel?: string;
}

export function UnauthorizedView({
  title = 'دسترسی مجاز نیست',
  message = 'شما به این صفحه دسترسی ندارید. اگر فکر می‌کنید اشتباهی رخ داده با مدیر سیستم تماس بگیرید.',
  homeHref = '/dashboard',
  homeLabel = 'بازگشت به داشبورد',
}: Props) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert size={36} className="text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-3">{title}</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href={homeHref}>
            <Button variant="secondary">
              <ArrowLeft size={16} />
              {homeLabel}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">
              <LayoutDashboard size={16} />
              داشبورد
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}