'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  HelpCircle,
  Menu,
  Search,
  Settings,
  LogOut,
  BookOpen,
  ExternalLink,
  Keyboard,
  Info,
} from 'lucide-react';

import { useAuth } from '@/shared/providers/auth-provider';
import { ThemeToggle } from '@/shared/components/theme/theme-toggle';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { UserAvatar } from '@/shared/components/ui/user-avatar';
import { cn } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Page titles
// ═════════════════════════════════════════════════════════════════

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

/** Nested routes with a specific title that differs from their parent. */
const nestedTitles: Array<{ prefix: string; title: string }> = [
  { prefix: '/responses/', title: 'جزئیات پاسخ' },
  { prefix: '/builder/', title: 'سازنده پرسشنامه' },
  { prefix: '/answer/', title: 'پاسخ‌دهی' },
];

/**
 * Resolve the human-readable title for a given pathname.
 * Handles exact matches, nested routes with custom titles, and
 * longest-prefix fallback for any other nested route.
 */
function resolveTitle(pathname: string): string {
  // 1. Custom nested titles (e.g. /responses/[id])
  for (const { prefix, title } of nestedTitles) {
    if (pathname.startsWith(prefix)) return title;
  }

  // 2. Exact match
  if (titleMap[pathname]) return titleMap[pathname];

  // 3. Longest prefix match (e.g. /questionnaires/new → پرسشنامه‌ها)
  const keys = Object.keys(titleMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname.startsWith(`${key}/`)) return titleMap[key];
  }

  return 'FORMly';
}

// ═════════════════════════════════════════════════════════════════
// Header
// ═════════════════════════════════════════════════════════════════

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  const title = resolveTitle(pathname);

  const displayName = user?.full_name?.trim() || user?.email || 'کاربر';
  const canSearch =
    !!user &&
    (user.is_admin || user.permissions?.includes('can_create_survey'));

  // ─────────────────────────────────────────────────────────────
  // Outside-click close (both dropdowns)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target)) setMenuOpen(false);
      if (!helpRef.current?.contains(target)) setHelpOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Escape closes any open dropdown
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      setHelpOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Search
  // ─────────────────────────────────────────────────────────────
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/questionnaires?search=${encodeURIComponent(q)}`);
    setSearchQuery('');
  };

  // ─────────────────────────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setMenuOpen(false);
    void logout();
  };

  return (
    <header className="flex-shrink-0 flex items-center h-14 px-4 lg:px-6 gap-3 bg-card border-b border-border">
      {/* ── Mobile menu button ─────────────────────────────── */}
      <button
        type="button"
        aria-label="باز کردن منوی کناری"
        className="lg:hidden shrink-0 text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-accent transition-colors"
        onClick={onOpenSidebar}
      >
        <Menu size={20} />
      </button>

      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm shrink-0 min-w-0">
        <span className="text-muted-foreground hidden sm:inline">FORMly</span>
        <span className="text-muted-foreground hidden sm:inline">/</span>
        <span className="font-medium truncate">{title}</span>
      </div>

      {/* ── Search (admin/creator only, md+) ───────────────── */}
      {/*
        `flex-1` on the wrapper absorbs all remaining space between
        the breadcrumb and the action cluster, keeping the search box
        centered. When this wrapper isn't rendered (user without the
        permission, or screen < md), the action cluster's `ms-auto`
        below is what pushes it to the inline-end of the header.
      */}
      {canSearch && (
        <div className="hidden md:flex flex-1 justify-center min-w-0">
          <div className="relative max-w-sm w-full">
            <Search
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="جستجوی پرسشنامه..."
              aria-label="جستجو در پرسشنامه‌ها"
              className={cn(
                'w-full pr-9 pl-4 py-1.5 text-sm',
                'bg-muted/60 border border-transparent rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background',
                'transition-all',
              )}
            />
          </div>
        </div>
      )}

      {/* ── Right actions ──────────────────────────────────── */}
      {/*
        IMPORTANT: use `ms-auto` (margin-inline-start: auto) instead of
        `ml-auto`. The app is RTL (html dir="rtl"), where the physical
        `margin-left` pushes the element toward the START (right) — the
        opposite of what we want. `ms-auto` uses the logical inline
        edge, so it always pushes toward the END regardless of writing
        direction. This makes the layout work identically with and
        without the search box.
      */}
      <div className="flex items-center gap-2 ms-auto shrink-0">
        <ThemeToggle />

        <NotificationBell />

        {/* ── Help dropdown ─────────────────────────────────── */}
        <div className="relative" ref={helpRef}>
          <button
            type="button"
            aria-label="راهنما"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((v) => !v)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <HelpCircle size={16} />
          </button>

          {helpOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 w-64 bg-popover rounded-xl border border-border shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
            >
              <a
                href="/api/docs/"
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setHelpOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <BookOpen size={14} />
                مستندات API
                <ExternalLink size={11} className="ml-auto text-muted-foreground" />
              </a>

              <div
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground cursor-default"
              >
                <Keyboard size={14} />
                میانبر: <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">Esc</kbd>
                {' '}بستن منوها
              </div>

              <div className="border-t border-border my-1" />

              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Info size={12} />
                FORMly · نسخه ۱٫۰
              </div>
            </div>
          )}
        </div>

        {/* ── User menu ─────────────────────────────────────── */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="منوی حساب کاربری"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <UserAvatar user={user} size="sm" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 w-60 bg-popover rounded-xl border border-border shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
            >
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-border flex items-center gap-3">
                <UserAvatar user={user} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {displayName}
                  </p>
                  {user?.email && user.email !== displayName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>

              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <Settings size={14} /> تنظیمات
              </Link>

              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
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