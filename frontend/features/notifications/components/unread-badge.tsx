'use client';

import { useEffect, useState } from 'react';
import { notificationsApi } from '../api';
import { toFa } from '@/shared/lib/utils';

interface UnreadBadgeProps {
  /**
   * - `'dot'`   → small red dot (for tight spaces)
   * - `'count'` → numeric badge (default)
   */
  variant?: 'dot' | 'count';
  className?: string;
}

/**
 * Live unread-notifications badge.
 *
 * NOTE: This performs its own polling. When used alongside
 * `<NotificationBell />`, both will poll independently. If you want a
 * single source of truth, lift this to a shared provider (see
 * `useUnreadCount` in `features/notifications/hooks.ts`).
 */
export function UnreadBadge({
  variant = 'count',
  className,
}: UnreadBadgeProps) {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = () => {
      notificationsApi
        .unreadCount()
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          /* silent */
        });
    };

    fetchCount();
    const timer = setInterval(fetchCount, 30_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (count === 0) return null;

  if (variant === 'dot') {
    return (
      <span
        className={`w-2 h-2 rounded-full bg-destructive flex-shrink-0 ${className ?? ''}`}
        aria-label={`${count} اعلان خوانده‌نشده`}
      />
    );
  }

  return (
    <span
      className={`min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${className ?? ''}`}
      aria-label={`${count} اعلان خوانده‌نشده`}
    >
      {count > 99 ? '۹۹+' : toFa(count)}
    </span>
  );
}