'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { HelpCircle, Menu, Search, Settings, LogOut } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { useAuth } from '@/shared/providers/auth-provider';
import { ThemeToggle } from '@/shared/components/theme/theme-toggle';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { UserAvatar } from '@/shared/components/ui/user-avatar';

const titleMap: Record<string, string> = {
  '/dashboard': 'داشبورد',
  '/questionnaires': 'پرسشنامه‌ها',
  '/my-questionnaires': 'پرسشنامه‌های من',
  '/assignments': 'تخصیص‌ها',
  '/responses': 'پاسخ‌ها',
  '/analytics': 'تحلیل‌ها',
  '/users': 'کاربران',
  '/activity': 'رویدادها',
  '/settings': 'تنظیمات',
  '/notifications': 'اعلان‌ها',
  '/templates': 'قالب‌ها',
};

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const title = titleMap[pathname] ?? 'FORMly';

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <header className="flex-shrink-0 flex items-center h-14 px-4 lg:px-6 gap-3 bg-card border-b border-border">
      <button
        className="lg:hidden text-muted-foreground hover:text-foreground p-2"
        onClick={onOpenSidebar}
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground hidden sm:inline">FORMly</span>
        <span className="text-muted-foreground hidden sm:inline">/</span>
        <span className="font-medium">{title}</span>
      </div>

      <div className="flex-1 hidden md:flex justify-center">
        <div className="relative max-w-sm w-full">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="جستجو..."
            className="w-full pr-9 pl-4 py-1.5 text-sm bg-muted/60 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-all"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        <NotificationBell />

        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
          <HelpCircle size={16} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <UserAvatar user={user} size="sm" />
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-full mt-1 w-60 bg-popover rounded-xl border border-border shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-2.5 border-b border-border flex items-center gap-3">
                <UserAvatar user={user} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </div>

              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <Settings size={14} /> تنظیمات
              </Link>

              <button
                onClick={() => void logout()}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut size={14} /> خروج از حساب
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}