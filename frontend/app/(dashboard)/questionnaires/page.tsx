'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, FileText, Grid3X3, List } from 'lucide-react';

import { surveysApi } from '@/features/surveys/api';
import type { Survey, SurveyStatus } from '@/features/surveys/types';
import { SurveyCard } from '@/features/surveys/components/survey-card';
import { SurveyStatusBadge } from '@/features/surveys/components/survey-status-badge';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Tabs } from '@/shared/components/ui/tabs';
import {
  Pagination,
  PAGE_SIZE_OPTIONS,
} from '@/shared/components/ui/pagination';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import { toFa, formatDate } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════

type TabKey = 'ALL' | SurveyStatus;
type ViewMode = 'grid' | 'table';

// ═════════════════════════════════════════════════════════════════
// Content
// ═════════════════════════════════════════════════════════════════

function QuestionnairesContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';

  // ── State ───────────────────────────────────────────────────
  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tab, setTab] = useState<TabKey>('ALL');
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState(initialSearch);
  const [debounced, setDebounced] = useState(initialSearch);

  // ── Sync `?search=` from URL (Header search) ────────────────
  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? '';
    if (urlSearch && urlSearch !== search) {
      setSearch(urlSearch);
      setDebounced(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Debounce search (300 ms) ────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Reset page when filters change ──────────────────────────
  useEffect(() => {
    setPage(1);
  }, [debounced, tab, pageSize]);

  // ── Load ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
        ordering: '-updated_at',
      };
      if (debounced) params.search = debounced;
      if (tab !== 'ALL') params.status = tab;

      const r = await surveysApi.list(params);
      setSurveys(r.results);
      setTotal(r.count);
    } catch {
      setSurveys([]);
      setTotal(0);
    }
  }, [page, pageSize, debounced, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  // ─────────────────────────────────────────────────────────────
  // ⭐ Optimistic handlers
  // ─────────────────────────────────────────────────────────────

  /**
   * Called immediately after a successful DELETE.
   * Removes the survey from the local list without a refetch.
   */
  const handleDeleted = useCallback((id: string) => {
    setSurveys((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  /**
   * Called immediately after a successful status change (close / archive).
   *
   * If we're filtering by a specific status (tab !== 'ALL') and the new
   * status no longer matches, we refetch to stay correct. Otherwise we
   * patch the item in place for an instant visual update.
   */
  const handleUpdated = useCallback(
    (updated: Survey) => {
      if (tab !== 'ALL' && updated.status !== tab) {
        void load();
        return;
      }
      setSurveys((prev) =>
        prev ? prev.map((s) => (s.id === updated.id ? updated : s)) : prev,
      );
    },
    [tab, load],
  );

  // ─────────────────────────────────────────────────────────────
  // Tab counts (page-scoped — backend doesn't expose per-status totals)
  // ─────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const list = surveys ?? [];
    return {
      ALL: total,
      DRAFT: list.filter((s) => s.status === 'DRAFT').length,
      PUBLISHED: list.filter((s) => s.status === 'PUBLISHED').length,
      CLOSED: list.filter((s) => s.status === 'CLOSED').length,
      ARCHIVED: list.filter((s) => s.status === 'ARCHIVED').length,
    };
  }, [surveys, total]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">پرسشنامه‌ها</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {toFa(total)} پرسشنامه در مجموع
          </p>
        </div>
        <Link href="/builder/new">
          <Button>
            <Plus size={16} /> پرسشنامه جدید
          </Button>
        </Link>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'ALL', label: 'همه', count: counts.ALL },
            { value: 'DRAFT', label: 'پیش‌نویس' },
            { value: 'PUBLISHED', label: 'منتشرشده' },
            { value: 'CLOSED', label: 'بسته' },
            { value: 'ARCHIVED', label: 'بایگانی' },
          ]}
        />

        {/* Search */}
        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو..."
            className="pr-9"
          />
        </div>

        {/* Right cluster: page size + view toggle */}
        <div className="mr-auto flex items-center gap-2">
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

          <div className="flex items-center bg-muted p-1 rounded-xl gap-0.5">
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-label="نمای شبکه‌ای"
              className={`p-1.5 rounded-lg transition-all ${
                view === 'grid'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              aria-label="نمای جدولی"
              className={`p-1.5 rounded-lg transition-all ${
                view === 'table'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {!surveys ? (
        <LoadingGrid view={view} />
      ) : surveys.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            debounced || tab !== 'ALL'
              ? 'پرسشنامه‌ای مطابق فیلتر یافت نشد'
              : 'هنوز پرسشنامه‌ای نساخته‌اید'
          }
          description={
            debounced || tab !== 'ALL'
              ? 'فیلترها را تغییر دهید یا جستجو را پاک کنید.'
              : 'اولین پرسشنامه‌ی خود را بسازید و پاسخ‌ها را جمع‌آوری کنید.'
          }
          action={
            !debounced && tab === 'ALL' ? (
              <Link href="/builder/new">
                <Button>
                  <Plus size={16} /> ساخت پرسشنامه
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : view === 'grid' ? (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {surveys.map((s) => (
              <SurveyCard
                key={s.id}
                survey={s}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
                onChanged={load}
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
      ) : (
        <>
          <TableView surveys={surveys} onDeleted={handleDeleted} />
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
// Table view
// ═════════════════════════════════════════════════════════════════

function TableView({
  surveys,
  onDeleted,
}: {
  surveys: Survey[];
  onDeleted: (id: string) => void;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground">
                عنوان
              </th>
              <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                سازنده
              </th>
              <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                سوالات
              </th>
              <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground">
                وضعیت
              </th>
              <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                بروزرسانی
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {surveys.map((s) => (
              <tr key={s.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-5 py-4">
                  <Link
                    href={`/builder/${s.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {s.title}
                  </Link>
                </td>
                <td className="px-4 py-4 text-muted-foreground hidden md:table-cell">
                  {s.created_by_email}
                </td>
                <td className="px-4 py-4 hidden lg:table-cell">
                  {toFa(s.questions_count)}
                </td>
                <td className="px-4 py-4">
                  <SurveyStatusBadge status={s.status} />
                </td>
                <td className="px-4 py-4 text-muted-foreground text-xs hidden md:table-cell">
                  {formatDate(s.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Loading skeleton
// ═════════════════════════════════════════════════════════════════

function LoadingGrid({ view }: { view: ViewMode }) {
  if (view === 'table') {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-64 w-full rounded-2xl" />
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Page wrapper
// ═════════════════════════════════════════════════════════════════

export default function QuestionnairesPage() {
  return (
    <RoleGuard roles={['admin', 'creator']}>
      <QuestionnairesContent />
    </RoleGuard>
  );
}