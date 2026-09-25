'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, Grid3X3, List, FileText } from 'lucide-react';

import { surveysApi } from '@/features/surveys/api';
import type { Survey, SurveyStatus } from '@/features/surveys/types';
import { SurveyCard } from '@/features/surveys/components/survey-card';
import { SurveyStatusBadge } from '@/features/surveys/components/survey-status-badge';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Tabs } from '@/shared/components/ui/tabs';
import { Pagination, PAGE_SIZE_OPTIONS } from '@/shared/components/ui/pagination';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import { toFa, formatDate } from '@/shared/lib/utils';

type TabKey = 'ALL' | SurveyStatus;
type ViewMode = 'grid' | 'table';

function QuestionnairesContent() {
  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tab, setTab] = useState<TabKey>('ALL');
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, tab, pageSize]);

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

  // Note: counts from current page only (backend doesn't return per-status totals)
  const counts = useMemo(() => {
    const list = surveys ?? [];
    return {
      ALL: total,
      DRAFT: list.filter((s) => s.status === 'DRAFT').length,
      PUBLISHED: list.filter((s) => s.status === 'PUBLISHED').length,
      CLOSED: list.filter((s) => s.status === 'CLOSED').length,
    };
  }, [surveys, total]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
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

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'ALL', label: 'همه' },
            { value: 'DRAFT', label: 'پیش‌نویس' },
            { value: 'PUBLISHED', label: 'منتشرشده' },
            { value: 'CLOSED', label: 'بسته' },
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

        <Button variant="outline" size="md">
          <Filter size={14} /> فیلتر
        </Button>

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
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                view === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded-lg transition-all ${
                view === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {!surveys ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : surveys.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="پرسشنامه‌ای یافت نشد"
          description="اولین پرسشنامه‌ی خود را بسازید و پاسخ‌ها را جمع‌آوری کنید."
          action={
            <Link href="/builder/new">
              <Button>
                <Plus size={16} /> ساخت پرسشنامه
              </Button>
            </Link>
          }
        />
      ) : view === 'grid' ? (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {surveys.map((s) => (
              <SurveyCard key={s.id} survey={s} />
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
        </>
      ) : (
        <>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground">عنوان</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">سازنده</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">سوالات</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground">وضعیت</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">بروزرسانی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {surveys.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/builder/${s.id}`} className="font-medium hover:text-primary">
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
          <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function QuestionnairesPage() {
  return (
    <RoleGuard roles={['admin', 'creator']}>
      <QuestionnairesContent />
    </RoleGuard>
  );
}