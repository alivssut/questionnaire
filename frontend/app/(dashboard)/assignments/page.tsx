'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  ClipboardList,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { assignmentsApi } from '@/features/assignments/api';
import type {
  Assignment,
  AssignmentStatus,
} from '@/features/assignments/types';
import { AssignModal } from '@/features/assignments/components/assign-modal';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs } from '@/shared/components/ui/tabs';
import {
  Pagination,
  PAGE_SIZE_OPTIONS,
} from '@/shared/components/ui/pagination';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { UserAvatar } from '@/shared/components/ui/user-avatar';
import { PageLoader } from '@/shared/components/ui/spinner';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import { getErrorMessage } from '@/shared/lib/api/client';
import { toFa, formatDate } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Config
// ═════════════════════════════════════════════════════════════════

type TabKey = 'ALL' | AssignmentStatus;

const statusConfig: Record<
  AssignmentStatus,
  {
    label: string;
    variant: 'info' | 'warning' | 'success' | 'danger';
    color: string;
  }
> = {
  PENDING: {
    label: 'در انتظار',
    variant: 'info',
    color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
  },
  IN_PROGRESS: {
    label: 'در حال انجام',
    variant: 'warning',
    color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  COMPLETED: {
    label: 'تکمیل‌شده',
    variant: 'success',
    color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  },
  OVERDUE: {
    label: 'منقضی',
    variant: 'danger',
    color: 'text-red-600 bg-red-500/10 border-red-500/20',
  },
};

// ═════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════

function AssignmentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const surveyFilter = searchParams.get('survey');

  const [items, setItems] = useState<Assignment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tab, setTab] = useState<TabKey>('ALL');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Assignment | null>(null);

  // ── Debounce search ────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, tab, pageSize]);

  // ── Load ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
        ordering: '-assigned_at',
      };
      if (debounced) params.search = debounced;
      if (tab !== 'ALL') params.status = tab;
      if (surveyFilter) params.survey = surveyFilter;

      const r = await assignmentsApi.list(params);
      setItems(r.results);
      setTotal(r.count);
    } catch {
      setItems([]);
      setTotal(0);
    }
  }, [page, pageSize, debounced, tab, surveyFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Auto-open modal when `?survey=` is present ────────────
  useEffect(() => {
    if (surveyFilter) setModalOpen(true);
  }, [surveyFilter]);

  // ── Derived: status counts (from current page) ────────────
  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      total,
      PENDING: list.filter((a) => a.status === 'PENDING').length,
      IN_PROGRESS: list.filter((a) => a.status === 'IN_PROGRESS').length,
      COMPLETED: list.filter((a) => a.status === 'COMPLETED').length,
      OVERDUE: list.filter(
        (a) => a.status === 'OVERDUE' || a.is_past_due,
      ).length,
    };
  }, [items, total]);

  // ── Handlers ───────────────────────────────────────────────
  const handleCloseModal = () => {
    setModalOpen(false);
    if (surveyFilter) router.replace('/assignments');
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await assignmentsApi.remove(toDelete.id);
      toast.success('تخصیص حذف شد');
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
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
          <h1 className="text-2xl font-bold">تخصیص‌ها</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {toFa(total)} تخصیص در مجموع
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> تخصیص جدید
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(
          ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'] as AssignmentStatus[]
        ).map((key) => {
          const cfg = statusConfig[key];
          return (
            <div key={key} className={`rounded-2xl border p-4 ${cfg.color}`}>
              <div className="text-2xl font-bold mb-0.5">
                {toFa(counts[key as keyof typeof counts] ?? 0)}
              </div>
              <div className="text-sm font-medium">{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'ALL', label: 'همه', count: total },
            { value: 'PENDING', label: 'در انتظار' },
            { value: 'IN_PROGRESS', label: 'در حال انجام' },
            { value: 'COMPLETED', label: 'تکمیل‌شده' },
            { value: 'OVERDUE', label: 'منقضی' },
          ]}
        />

        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو..."
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
              {toFa(s)} / صفحه
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {!items ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            total === 0
              ? 'هنوز تخصیصی ساخته نشده'
              : 'تخصیصی مطابق فیلتر یافت نشد'
          }
          description={
            total === 0
              ? 'اولین تخصیص خود را بسازید و پرسشنامه را به کاربران ارسال کنید.'
              : undefined
          }
          action={
            total === 0 ? (
              <Button onClick={() => setModalOpen(true)}>
                <Plus size={16} /> تخصیص جدید
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground">
                      کاربر
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                      پرسشنامه
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                      تاریخ تخصیص
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                      موعد
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground">
                      وضعیت
                    </th>
                    <th className="w-12 px-4 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((a) => {
                    const isPastDue =
                      a.status === 'OVERDUE' || a.is_past_due;
                    const cfg = isPastDue
                      ? statusConfig.OVERDUE
                      : statusConfig[a.status];

                    return (
                      <tr
                        key={a.id}
                        className="hover:bg-accent/50 transition-colors"
                      >
                        {/* ═══ User cell with avatar ═══ */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              user={{
                                avatar: a.user.avatar ?? null,
                                full_name: a.user.full_name,
                                email: a.user.email,
                              }}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {a.user.full_name || a.user.email}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {a.user.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Survey title */}
                        <td className="px-4 py-4 text-muted-foreground hidden md:table-cell max-w-xs">
                          <p className="truncate">{a.survey_title}</p>
                        </td>

                        {/* Assigned date */}
                        <td className="px-4 py-4 text-xs text-muted-foreground hidden lg:table-cell">
                          {formatDate(a.assigned_at)}
                        </td>

                        {/* Due date */}
                        <td className="px-4 py-4 text-xs hidden lg:table-cell">
                          <span
                            className={
                              isPastDue
                                ? 'text-destructive font-medium'
                                : 'text-muted-foreground'
                            }
                          >
                            {a.due_date
                              ? formatDate(a.due_date)
                              : 'بدون موعد'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </td>

                        {/* Delete */}
                        <td className="px-4 py-4 text-left">
                          <button
                            onClick={() => setToDelete(a)}
                            className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                            title="حذف تخصیص"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* Assign Modal */}
      <AssignModal
        open={modalOpen}
        onClose={handleCloseModal}
        onCreated={load}
        initialSurveyId={surveyFilter}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="حذف تخصیص"
        description={
          toDelete
            ? `تخصیص «${toDelete.survey_title}» به ${toDelete.user.full_name} حذف شود؟`
            : ''
        }
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Page wrapper with role guard + Suspense
// ═════════════════════════════════════════════════════════════════

export default function AssignmentsPage() {
  return (
    <RoleGuard roles={['admin', 'creator']}>
      <Suspense fallback={<PageLoader />}>
        <AssignmentsContent />
      </Suspense>
    </RoleGuard>
  );
}