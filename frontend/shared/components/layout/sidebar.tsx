'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  Activity,
  Zap,
  LogOut,
  CheckSquare,
  BookOpen,
  Bell,
  ChevronLeft,
  Sparkles,
  Shield,
  PencilRuler,
  User,
} from 'lucide-react';

import { useAuth } from '@/shared/providers/auth-provider';
import { useUserRole, type UserRole } from '@/shared/hooks/use-user-role';
import { useMyAssignmentsCount } from '@/shared/hooks/use-my-assignments-count';
import { UserAvatar } from '@/shared/components/ui/user-avatar';
import { cn, toFa } from '@/shared/lib/utils';
import { UnreadBadge } from '@/features/notifications/components/unread-badge';

// ═════════════════════════════════════════════════════════════════
// Types & config
// ═════════════════════════════════════════════════════════════════

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  /**
   * - `'unread'`       → render the live unread-notifications badge
   * - `'assignments'`  → render the live "my assignments" count (only if > 0)
   * - number           → render a static numeric badge
   */
  badge?: 'unread' | 'assignments' | number;
  /**
   * Optional predicate. When provided, the item is shown only if this
   * returns true (in addition to the role check).
   */
  visible?: (ctx: { myAssignmentsCount: number | null }) => boolean;
}

interface NavSection {
  title?: string;
  icon?: typeof LayoutDashboard;
  items: NavItem[];
  roles: UserRole[];
}

const sections: NavSection[] = [
  {
    title: 'عمومی',
    items: [
      {
        label: 'داشبورد',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['admin', 'creator', 'user'],
      },
      {
        label: 'اعلان‌ها',
        href: '/notifications',
        icon: Bell,
        roles: ['admin', 'creator', 'user'],
        badge: 'unread',
      },
      {
        label: 'پرسشنامه‌های من',
        href: '/my-questionnaires',
        icon: BookOpen,
        roles: ['admin', 'creator', 'user'],
        badge: 'assignments',
        visible: ({ myAssignmentsCount }) => {
          if (myAssignmentsCount === null) return false;
          return myAssignmentsCount > 0;
        },
      },
      {
        // Regular users see their own responses only — same page, but
        // a simpler UI (no "respondent" column, no export menu).
        label: 'پاسخ‌های من',
        href: '/responses',
        icon: CheckSquare,
        roles: ['user'],
      },
    ],
    roles: ['admin', 'creator', 'user'],
  },
  {
    title: 'مدیریت پرسشنامه',
    icon: PencilRuler,
    items: [
      { label: 'پرسشنامه‌ها', href: '/questionnaires', icon: FileText, roles: ['admin', 'creator'] },
      { label: 'قالب‌ها', href: '/templates', icon: Sparkles, roles: ['admin', 'creator'] },
      { label: 'تخصیص‌ها', href: '/assignments', icon: ClipboardList, roles: ['admin', 'creator'] },
      { label: 'پاسخ‌ها', href: '/responses', icon: CheckSquare, roles: ['admin', 'creator'] },
    ],
    roles: ['admin', 'creator'],
  },
  {
    title: 'گزارش‌گیری',
    icon: BarChart3,
    items: [
      { label: 'تحلیل‌ها', href: '/analytics', icon: BarChart3, roles: ['admin', 'creator'] },
      { label: 'رویدادها', href: '/activity', icon: Activity, roles: ['admin'] },
    ],
    roles: ['admin', 'creator'],
  },
  {
    title: 'سیستم',
    icon: Shield,
    items: [
      { label: 'کاربران', href: '/users', icon: Users, roles: ['admin'] },
      { label: 'تنظیمات', href: '/settings', icon: Settings, roles: ['admin', 'creator', 'user'] },
    ],
    roles: ['admin', 'creator', 'user'],
  },
];

const roleMeta: Record<UserRole, { label: string; color: string; icon: typeof User }> = {
  admin: {
    label: 'مدیر',
    color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
    icon: Shield,
  },
  creator: {
    label: 'سازنده',
    color: 'bg-primary/15 text-primary border-primary/20',
    icon: PencilRuler,
  },
  user: {
    label: 'کاربر',
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: User,
  },
};

// ═════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = useUserRole();
  const myAssignmentsCount = useMyAssignmentsCount();

  const meta = roleMeta[role];
  const RoleIcon = meta.icon;

  // Regular users and creators always see `/my-questionnaires` —
  // it is part of their primary workflow (they both respond to surveys).
  // Admins see it only when they actually have actionable assignments.
  const alwaysShowMyQuestionnaires = role === 'user' || role === 'creator';

  const visibleSections = sections
    .filter((s) => s.roles.includes(role))
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => {
        if (!item.roles.includes(role)) return false;

        // Short-circuit: for user/creator, "my-questionnaires" is always shown.
        if (item.href === '/my-questionnaires' && alwaysShowMyQuestionnaires) {
          return true;
        }

        // Otherwise, defer to the `visible` predicate if provided.
        if (item.visible) {
          return item.visible({ myAssignmentsCount });
        }
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <aside className="flex flex-col h-full w-64 bg-card border-l border-border relative">
      {/* Subtle gradient accent at top */}
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />

      {/* ── Logo ─────────────────────────────────────────── */}
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="relative flex items-center gap-2.5 px-5 py-5 border-b border-border group"
      >
        <div className="relative w-9 h-9 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
          <Zap size={17} className="text-primary-foreground" strokeWidth={2.5} />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-extrabold tracking-tight leading-none">
            FORMly
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5 font-medium tracking-widest uppercase">
            پرسشنامه‌ساز
          </span>
        </div>
      </Link>

      {/* ── Nav sections ─────────────────────────────────── */}
      <nav className="relative flex-1 px-3 py-4 overflow-y-auto">
        {visibleSections.map((section, si) => (
          <div key={section.title ?? si} className={cn(si > 0 && 'mt-5')}>
            {section.title && (
              <div className="flex items-center gap-1.5 px-3 mb-2">
                {section.icon && (
                  <section.icon
                    size={10}
                    className="text-muted-foreground/60 flex-shrink-0"
                  />
                )}
                <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                  {section.title}
                </span>
              </div>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-l-full" />
                    )}

                    <Icon
                      size={16}
                      className={cn(
                        'flex-shrink-0 transition-transform group-hover:scale-110',
                        active && 'drop-shadow-sm',
                      )}
                    />

                    <span className="flex-1 truncate">{item.label}</span>

                    {item.badge === 'unread' && <UnreadBadge />}

                    {item.badge === 'assignments' &&
                      myAssignmentsCount !== null &&
                      myAssignmentsCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                          {toFa(myAssignmentsCount)}
                        </span>
                      )}

                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                        {toFa(item.badge)}
                      </span>
                    )}

                    <ChevronLeft
                      size={12}
                      className={cn(
                        'flex-shrink-0 transition-all',
                        active
                          ? 'opacity-100 text-primary'
                          : 'opacity-0 -translate-x-1 group-hover:opacity-40 group-hover:translate-x-0',
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User card ────────────────────────────────────── */}
      <div className="relative border-t border-border p-3 bg-gradient-to-t from-muted/30 to-transparent">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/70 transition-all group"
        >
          <UserAvatar user={user} size="lg" online />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">
              {user?.full_name || user?.email}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border',
                  meta.color,
                )}
              >
                <RoleIcon size={9} />
                {meta.label}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void logout();
            }}
            title="خروج از حساب"
            className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-2 rounded-lg"
          >
            <LogOut size={15} />
          </button>
        </Link>
      </div>
    </aside>
  );
}