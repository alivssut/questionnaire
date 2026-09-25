'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Users,
  Trash2,
  UserCheck,
  UserX,
  ShieldOff,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient, getErrorMessage } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type { Paginated } from '@/shared/types';
import type { AuthUser } from '@/features/auth/types';

import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Pagination,
  PAGE_SIZE_OPTIONS,
} from '@/shared/components/ui/pagination';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { UserAvatar } from '@/shared/components/ui/user-avatar';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import { formatDate, toFa, cn } from '@/shared/lib/utils';
import { useAuth } from '@/shared/providers/auth-provider';

// ═════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════

type BulkAction =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'promote' }
  | { kind: 'demote' }
  | { kind: 'delete' }
  | null;

// ═════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════

function UsersContent() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [busy, setBusy] = useState(false);

  // ── Debounce search ────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ── Load ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Paginated<AuthUser>>(
        endpoints.users,
        {
          params: {
            page,
            page_size: pageSize,
            search: debouncedSearch || undefined,
            ordering: '-created_at',
          },
        },
      );
      setUsers(data.results);
      setTotal(data.count);

      // Drop selections that are no longer visible
      setSelected((prev) => {
        const ids = new Set(data.results.map((u) => u.id));
        const next = new Set<string>();
        prev.forEach((id) => ids.has(id) && next.add(id));
        return next;
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setUsers([]);
      setTotal(0);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Selection helpers ──────────────────────────────────────
  const allVisibleSelected =
    (users?.length ?? 0) > 0 && users!.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0 && !allVisibleSelected;

  const toggleAll = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(users!.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Bulk action meta ───────────────────────────────────────
  const bulkMeta = useMemo(() => {
    if (!bulkAction) return null;
    const count = selected.size;
    const t = (n: number) => toFa(n);

    switch (bulkAction.kind) {
      case 'activate':
        return {
          title: `فعال‌سازی ${t(count)} کاربر`,
          description: 'کاربران انتخاب‌شده می‌توانند دوباره وارد شوند.',
          label: 'فعال‌سازی',
          variant: 'default' as const,
        };
      case 'deactivate':
        return {
          title: `غیرفعال‌سازی ${t(count)} کاربر`,
          description:
            'کاربران انتخاب‌شده از ورود منع می‌شوند و توکن‌هایشان باطل می‌شود.',
          label: 'غیرفعال‌سازی',
          variant: 'danger' as const,
        };
      case 'promote':
        return {
          title: `ارتقا ${t(count)} کاربر به مدیر`,
          description: 'دسترسی کامل مدیریت به این کاربران داده می‌شود.',
          label: 'ارتقا به مدیر',
          variant: 'default' as const,
        };
      case 'demote':
        return {
          title: `سلب دسترسی مدیر از ${t(count)} کاربر`,
          description: 'این کاربران دیگر مدیر نخواهند بود.',
          label: 'سلب دسترسی',
          variant: 'danger' as const,
        };
      case 'delete':
        return {
          title: `غیرفعال‌سازی ${t(count)} کاربر`,
          description:
            'این عملیات کاربران را غیرفعال می‌کند (حذف نرم). برای بازگشت باید دستی فعالشان کنید.',
          label: 'غیرفعال‌سازی',
          variant: 'danger' as const,
        };
    }
  }, [bulkAction, selected.size]);

  // ── Run bulk action ────────────────────────────────────────
  const runBulk = async () => {
    if (!bulkAction) return;
    setBusy(true);

    const ids = Array.from(selected);
    const safeIds = ids.filter((id) => id !== me?.id);
    const skippedSelf = ids.length - safeIds.length;

    if (skippedSelf > 0) {
      toast.info(`حساب خودتان از عملیات حذف شد (${toFa(skippedSelf)} مورد)`);
    }

    try {
      let updated = 0;
      switch (bulkAction.kind) {
        case 'activate': {
          updated = await bulkPatch(safeIds, { is_active: true });
          toast.success(`${toFa(updated)} کاربر فعال شد`);
          break;
        }
        case 'deactivate': {
          updated = await bulkPatch(safeIds, { is_active: false });
          toast.success(`${toFa(updated)} کاربر غیرفعال شد`);
          break;
        }
        case 'promote': {
          updated = await bulkPatch(safeIds, { is_admin: true });
          toast.success(`${toFa(updated)} کاربر ارتقا یافت`);
          break;
        }
        case 'demote': {
          updated = await bulkPatch(safeIds, { is_admin: false });
          toast.success(`${toFa(updated)} کاربر سلب دسترسی شد`);
          break;
        }
        case 'delete': {
          updated = await bulkDelete(safeIds);
          toast.success(`${toFa(updated)} کاربر غیرفعال شد`);
          break;
        }
      }
      setSelected(new Set());
      setBulkAction(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">کاربران</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {toFa(total)} کاربر در مجموع
          </p>
        </div>
      </div>

      {/* Search + Page size */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی کاربر..."
            className="pr-9"
          />
        </div>

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="h-10 px-3 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {toFa(s)} در صفحه
            </option>
          ))}
        </select>
      </div>

      {/* Selection toolbar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-primary px-2">
            {toFa(selected.size)} کاربر انتخاب شده
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkAction({ kind: 'activate' })}
          >
            <UserCheck size={14} /> فعال‌سازی
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkAction({ kind: 'deactivate' })}
          >
            <UserX size={14} /> غیرفعال‌سازی
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkAction({ kind: 'promote' })}
          >
            <Shield size={14} /> ارتقا به مدیر
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkAction({ kind: 'demote' })}
          >
            <ShieldOff size={14} /> سلب دسترسی
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkAction({ kind: 'delete' })}
          >
            <Trash2 size={14} /> حذف
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            لغو انتخاب
          </button>
        </div>
      )}

      {/* Content */}
      {!users ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'کاربری مطابق جستجو یافت نشد' : 'کاربری وجود ندارد'}
        />
      ) : (
        <>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-12 px-4 py-3.5">
                      <Checkbox
                        checked={
                          allVisibleSelected
                            ? true
                            : someSelected
                            ? 'indeterminate'
                            : false
                        }
                        onChange={toggleAll}
                        aria-label="انتخاب همه"
                      />
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground">
                      کاربر
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                      نقش
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                      تاریخ عضویت
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground">
                      وضعیت
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => {
                    const isMe = u.id === me?.id;
                    const isSelected = selected.has(u.id);
                    const isAdmin = u.is_admin;
                    const isCreator =
                      !isAdmin &&
                      u.permissions?.includes('can_create_survey');

                    return (
                      <tr
                        key={u.id}
                        className={cn(
                          'transition-colors',
                          isSelected ? 'bg-primary/5' : 'hover:bg-accent/50',
                        )}
                      >
                        <td className="px-4 py-4">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleOne(u.id)}
                            disabled={isMe}
                            aria-label={`انتخاب ${u.email}`}
                          />
                        </td>

                        {/* ═══ User cell with avatar ═══ */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              user={{
                                avatar: u.avatar,
                                full_name: u.full_name,
                                email: u.email,
                                first_name: u.first_name,
                                last_name: u.last_name,
                              }}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {u.full_name || '—'}
                                {isMe && (
                                  <span className="text-xs text-primary mr-2">
                                    (شما)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-4 hidden md:table-cell">
                          {isAdmin ? (
                            <Badge variant="info">مدیر</Badge>
                          ) : isCreator ? (
                            <Badge variant="success">سازنده</Badge>
                          ) : (
                            <Badge>کاربر</Badge>
                          )}
                        </td>

                        {/* Joined at */}
                        <td className="px-4 py-4 text-xs text-muted-foreground hidden lg:table-cell">
                          {formatDate(u.created_at)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <Badge variant={u.is_active ? 'success' : 'danger'}>
                            {u.is_active ? 'فعال' : 'غیرفعال'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onChange={setPage}
          />
        </>
      )}

      {/* Confirm bulk action */}
      {bulkMeta && (
        <ConfirmDialog
          open={!!bulkAction}
          onClose={() => !busy && setBulkAction(null)}
          onConfirm={runBulk}
          title={bulkMeta.title}
          description={bulkMeta.description}
          confirmLabel={bulkMeta.label}
          variant={bulkMeta.variant}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Bulk helpers (backend has no bulk endpoint → per-user calls in batches)
// ═════════════════════════════════════════════════════════════════

async function bulkPatch(
  ids: string[],
  patch: { is_active?: boolean; is_admin?: boolean },
): Promise<number> {
  const BATCH_SIZE = 10;
  let updated = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => apiClient.patch(`${endpoints.users}${id}/`, patch)),
    );
    updated += results.filter((r) => r.status === 'fulfilled').length;
  }

  return updated;
}

async function bulkDelete(ids: string[]): Promise<number> {
  const BATCH_SIZE = 10;
  let deactivated = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => apiClient.delete(`${endpoints.users}${id}/`)),
    );
    deactivated += results.filter((r) => r.status === 'fulfilled').length;
  }

  return deactivated;
}

// ═════════════════════════════════════════════════════════════════
// Page wrapper with role guard
// ═════════════════════════════════════════════════════════════════

export default function UsersPage() {
  return (
    <RoleGuard roles={['admin']}>
      <UsersContent />
    </RoleGuard>
  );
}