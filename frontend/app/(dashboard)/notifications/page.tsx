'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell, CheckCheck, Loader2, AlertCircle, CheckCircle2,
  Clock, FileText, Info, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

import { notificationsApi } from '@/features/notifications/api';
import {
  NOTIFICATION_TYPE_CONFIG,
  type Notification,
  type NotificationType,
} from '@/features/notifications/types';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs } from '@/shared/components/ui/tabs';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Pagination, PAGE_SIZE_OPTIONS } from '@/shared/components/ui/pagination';
import { getErrorMessage } from '@/shared/lib/api/client';
import { cn, toFa, formatRelative } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Config
// ═════════════════════════════════════════════════════════════════

type TabKey = 'ALL' | 'UNREAD' | NotificationType;

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  ASSIGNMENT_CREATED: FileText,
  REMINDER: Clock,
  COMPLETED: CheckCircle2,
  SYSTEM: Info,
};

/** Extract survey ID from metadata for quick navigation. */
function metadataLink(n: Notification): string | null {
  if (n.metadata?.survey_id) {
    return `/answer/${n.metadata.survey_id}`;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tab, setTab] = useState<TabKey>('ALL');
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

  // ── Reset page when tab or pageSize changes ─────────────────
  useEffect(() => {
    setPage(1);
  }, [tab, pageSize]);

  // ── Load notifications ──────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
        ordering: '-created_at',
      };
      if (tab === 'UNREAD') params.is_read = false;
      else if (tab !== 'ALL') params.type = tab;

      const r = await notificationsApi.list(params);
      setItems(r.results);
      setTotal(r.count);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Refresh unread count (for the "خواندن همه" button state) ─
  const refreshUnread = useCallback(async () => {
    try {
      const n = await notificationsApi.unreadCount();
      setUnreadTotal(n);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  // ── Actions ─────────────────────────────────────────────────
  const handleMarkRead = async (n: Notification) => {
    if (n.is_read || busyIds.has(n.id)) return;
    setBusyIds((prev) => new Set(prev).add(n.id));
    try {
      await notificationsApi.markRead(n.id);
      setItems((prev) =>
        prev ? prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) : prev,
      );
      setUnreadTotal((u) => Math.max(0, u - 1));
      // If we're on the UNREAD tab, the item no longer matches — reload
      if (tab === 'UNREAD') void load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadTotal === 0) return;
    setMarkingAll(true);
    try {
      const res = await notificationsApi.markAllRead();
      setItems((prev) => (prev ? prev.map((n) => ({ ...n, is_read: true })) : prev));
      setUnreadTotal(0);
      toast.success(`${toFa(res.updated)} اعلان خوانده شد`);
      if (tab === 'UNREAD') void load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMarkingAll(false);
    }
  };

  // ── Tab items (counts are best-effort from current page) ────
  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      pageTotal: total,
      pageUnread: list.filter((n) => !n.is_read).length,
    };
  }, [items, total]);

  // ═════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">اعلان‌ها</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {unreadTotal > 0
              ? `${toFa(unreadTotal)} اعلان خوانده‌نشده دارید`
              : 'همه اعلان‌ها را خوانده‌اید'}
          </p>
        </div>

        {unreadTotal > 0 && (
          <Button
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCheck size={16} />
            )}
            خواندن همه
          </Button>
        )}
      </div>

      {/* Toolbar: tabs + page size */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'ALL', label: 'همه', count: total },
            { value: 'UNREAD', label: 'خوانده‌نشده', count: unreadTotal },
            { value: 'ASSIGNMENT_CREATED', label: 'تخصیص‌ها' },
            { value: 'REMINDER', label: 'یادآوری' },
            { value: 'COMPLETED', label: 'تکمیل‌شده' },
            { value: 'SYSTEM', label: 'سیستمی' },
          ]}
        />

        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="h-10 px-3 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {toFa(s)} / صفحه
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={
            tab === 'UNREAD'
              ? 'اعلان خوانده‌نشده‌ای ندارید'
              : tab === 'ALL'
              ? 'هنوز اعلانی دریافت نکرده‌اید'
              : 'اعلانی در این دسته نیست'
          }
          description={
            tab === 'ALL'
              ? 'اعلان‌های مربوط به تخصیص‌ها، یادآوری‌ها و رویدادهای سیستم اینجا نمایش داده می‌شوند.'
              : undefined
          }
        />
      ) : (
        <>
          <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                busy={busyIds.has(n.id)}
                onMarkRead={() => handleMarkRead(n)}
              />
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Row
// ═════════════════════════════════════════════════════════════════

function NotificationRow({
  notification: n,
  busy,
  onMarkRead,
}: {
  notification: Notification;
  busy: boolean;
  onMarkRead: () => void;
}) {
  const cfg = NOTIFICATION_TYPE_CONFIG[n.type];
  const Icon = TYPE_ICONS[n.type];
  const link = metadataLink(n);

  return (
    <div
      className={cn(
        'flex items-start gap-4 px-5 py-4 transition-colors',
        !n.is_read && 'bg-primary/[0.03]',
        'hover:bg-accent/30',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          cfg.color,
        )}
      >
        <Icon size={18} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p
            className={cn(
              'text-sm leading-snug',
              !n.is_read ? 'font-bold' : 'font-medium',
            )}
          >
            {n.title}
          </p>
          {!n.is_read && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
          )}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
          {n.message}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelative(n.created_at)}
          </span>

          {link && (
            <Link
              href={link}
              className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
            >
              مشاهده <ArrowLeft size={11} />
            </Link>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!n.is_read && (
          <button
            onClick={onMarkRead}
            disabled={busy}
            title="علامت‌گذاری به‌عنوان خوانده‌شده"
            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}