'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { notificationsApi } from '../api';
import { NOTIFICATION_TYPE_CONFIG, type Notification } from '../types';
import { getErrorMessage } from '@/shared/lib/api/client';
import { cn, formatRelative } from '@/shared/lib/utils';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // ── Poll unread count every 30s ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetch = () => {
      notificationsApi
        .unreadCount()
        .then((n) => {
          if (!cancelled) setUnread(n);
        })
        .catch(() => {
          /* silent */
        });
    };
    fetch();
    const t = setInterval(fetch, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // ── Close on outside click ──────────────────────────────────
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── Fetch list when dropdown opens ──────────────────────────
  useEffect(() => {
    if (!open || items !== null) return;
    setLoading(true);
    notificationsApi
      .list({ page_size: 8 })
      .then((r) => setItems(r.results))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, items]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setItems((prev) =>
        prev ? prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)) : prev,
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => (prev ? prev.map((n) => ({ ...n, is_read: true })) : prev));
      setUnread(0);
      toast.success('همه اعلان‌ها خوانده شدند');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
        aria-label="اعلان‌ها"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
            {unread > 99 ? '۹۹+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-popover border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">اعلان‌ها</h3>
              {unread > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
              >
                <CheckCheck size={11} /> خواندن همه
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : !items || items.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                اعلانی ندارید
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((n) => {
                  const cfg = NOTIFICATION_TYPE_CONFIG[n.type];
                  return (
                    <button
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      className={cn(
                        'w-full text-right px-4 py-3 hover:bg-accent/50 transition-colors flex items-start gap-3',
                        !n.is_read && 'bg-primary/5',
                      )}
                    >
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                          n.is_read ? 'bg-transparent' : 'bg-primary',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug line-clamp-1">
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className={cn(
                              'text-[10px] font-medium px-1.5 py-0.5 rounded',
                              cfg.color,
                            )}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelative(n.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-primary hover:underline font-medium py-2"
            >
              مشاهده همه اعلان‌ها
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}