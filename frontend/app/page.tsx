'use client';

import Link from 'next/link';
import {
  Zap, ArrowLeft, CheckCircle2, BarChart3, Users, FileText,
  Shield, Sparkles, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/shared/providers/auth-provider';
import { Button } from '@/shared/components/ui/button';
import { ThemeToggle } from '@/shared/components/theme/theme-toggle';

const features = [
  {
    icon: FileText,
    title: 'ساخت آسان پرسشنامه',
    description: 'با کشیدن و رها کردن، پرسشنامه‌های حرفه‌ای در چند دقیقه بسازید.',
  },
  {
    icon: Users,
    title: 'تخصیص هوشمند',
    description: 'به کاربران یا تیم‌های مختلف تخصیص دهید و پیشرفت را رصد کنید.',
  },
  {
    icon: BarChart3,
    title: 'تحلیل قدرتمند',
    description: 'نمودارها و آمار لحظه‌ای از پاسخ‌ها، نرخ تکمیل و شاخص NPS.',
  },
  {
    icon: Shield,
    title: 'امنیت و حریم خصوصی',
    description: 'پاسخ‌های ناشناس، کنترل دسترسی و لاگ کامل رویدادها.',
  },
];

const steps = [
  { n: 1, title: 'پرسشنامه بسازید', desc: 'از میان ۲۲ نوع سوال انتخاب کنید.' },
  { n: 2, title: 'منتشر کنید', desc: 'به کاربران تخصیص دهید یا عمومی کنید.' },
  { n: 3, title: 'تحلیل کنید', desc: 'در لحظه نتایج را ببینید و تصمیم بگیرید.' },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <Zap size={16} className="text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">FORMly</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 mr-8 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">امکانات</a>
            <a href="#how" className="text-muted-foreground hover:text-foreground transition-colors">چطور کار می‌کند</a>
          </nav>

          <div className="mr-auto flex items-center gap-2">
            <ThemeToggle />
            {!isLoading && (
              isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="sm">
                    <LayoutDashboard size={14} /> داشبورد
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm">ورود</Button>
                  </Link>
                  <Link href="/register" className="hidden sm:inline-flex">
                    <Button size="sm">ثبت‌نام رایگان</Button>
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              <Sparkles size={12} /> نسخه جدید با ۲۲ نوع سوال
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-balance">
              پرسشنامه‌های بهتر بسازید،
              <br />
              <span className="bg-gradient-to-l from-primary to-purple-500 bg-clip-text text-transparent">
                پاسخ‌های دقیق‌تری دریافت کنید.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              FORMly یک پلتفرم کامل برای ساخت، توزیع و تحلیل پرسشنامه است.
              از تیم‌های منابع انسانی تا پژوهش‌های بازار.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href={isAuthenticated ? '/dashboard' : '/register'}>
                <Button size="lg">
                  {isAuthenticated ? 'رفتن به داشبورد' : 'شروع رایگان'}
                  <ArrowLeft size={16} />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg">ورود به حساب</Button>
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" /> بدون نیاز به کارت اعتباری
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" /> راه‌اندازی در ۲ دقیقه
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">همه‌چیز برای نظرسنجی حرفه‌ای</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              ابزارهایی که برای ساختن پرسشنامه‌های مؤثر نیاز دارید.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-6 rounded-2xl border border-border bg-card hover:shadow-md transition-shadow">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <h3 className="font-bold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 bg-muted/30 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">در سه مرحله ساده</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                    {s.n}
                  </div>
                  <h3 className="font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowLeft size={20} className="hidden md:block absolute top-6 -left-3 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">آماده شروع هستید؟</h2>
          <p className="text-muted-foreground mb-8">
            همین امروز اولین پرسشنامه‌تان را بسازید.
          </p>
          <Link href={isAuthenticated ? '/dashboard' : '/register'}>
            <Button size="lg">
              {isAuthenticated ? 'رفتن به داشبورد' : 'شروع رایگان'}
              <ArrowLeft size={16} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            <span>© ۱۴۰۴ FORMly. تمامی حقوق محفوظ است.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground">درباره ما</a>
            <a href="#" className="hover:text-foreground">حریم خصوصی</a>
            <a href="#" className="hover:text-foreground">تماس</a>
          </div>
        </div>
      </footer>
    </div>
  );
}