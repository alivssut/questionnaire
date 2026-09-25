'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Search, Download } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient, getErrorMessage } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type { Paginated } from '@/shared/types';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Pagination, PAGE_SIZE_OPTIONS } from '@/shared/components/ui/pagination';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ExportMenu } from '@/shared/components/ui/export-menu';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import { downloadCSV } from '@/shared/lib/export/csv';
import { downloadExcel } from '@/shared/lib/export/excel';
import { toFa, formatDateTime, initials } from '@/shared/lib/utils';

interface ResponseRow {
  id: string;
  survey: string;
  survey_title?: string;
  user: { full_name: string; email: string } | null;
  status: 'DRAFT' | 'SUBMITTED';
  started_at: string;
  submitted_at: string | null;
  completion_time: string | null;
}

function ResponsesContent() {
  const [items, setItems] = useState<ResponseRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Paginated<ResponseRow>>(endpoints.responses, {
        params: {
          page,
          page_size: pageSize,
          search: debounced || undefined,
          ordering: '-started_at',
        },
      });
      setItems(data.results);
      setTotal(data.count);
    } catch {
      setItems([]);
      setTotal(0);
    }
  }, [page, pageSize, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  // Fetch all for export
  const fetchAll = useCallback(async (): Promise<ResponseRow[]> => {
    const { data } = await apiClient.get<Paginated<ResponseRow>>(endpoints.responses, {
      params: { page_size: 1000, search: debounced || undefined, ordering: '-started_at' },
    });
    return data.results;
  }, [debounced]);

  const columns = [
    { key: 'survey_title' as const, label: 'پرسشنامه' },
    { key: 'user' as const, label: 'کاربر' },
    { key: 'status' as const, label: 'وضعیت' },
    { key: 'started_at' as const, label: 'شروع' },
    { key: 'submitted_at' as const, label: 'ارسال' },
  ];

  const normalize = (rows: ResponseRow[]) =>
    rows.map((r) => ({
      survey_title: r.survey_title ?? r.survey,
      user: r.user ? `${r.user.full_name} (${r.user.email})` : 'ناشناس',
      status: r.status === 'SUBMITTED' ? 'ارسال‌شده' : 'پیش‌نویس',
      started_at: r.started_at ?? '',
      submitted_at: r.submitted_at ?? '',
    }));

  const handleCSV = async () => {
    setExporting(true);
    try {
      const all = await fetchAll();
      downloadCSV(normalize(all), columns, `responses-${Date.now()}`);
      toast.success('CSV دانلود شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const handleExcel = async () => {
    setExporting(true);
    try {
      const all = await fetchAll();
      downloadExcel(normalize(all), columns, `responses-${Date.now()}`, 'پاسخ‌ها');
      toast.success('Excel دانلود شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">پاسخ‌ها</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {toFa(total)} پاسخ دریافت شده
          </p>
        </div>
        <ExportMenu
          onExportCSV={handleCSV}
          onExportExcel={handleExcel}
          disabled={exporting || total === 0}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی پاسخ‌دهنده..."
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
            <option key={s} value={s}>{toFa(s)} در صفحه</option>
          ))}
        </select>
      </div>

      {!items ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : items.length === 0 ? (
        <EmptyState icon={Download} title="پاسخی یافت نشد" />
      ) : (
        <>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground">
                      پاسخ‌دهنده
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                      پرسشنامه
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                      شروع
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                      ارسال
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground">
                      وضعیت
                    </th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-violet-600">
                              {initials(r.user?.full_name ?? 'ناشناس')}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {r.user?.full_name ?? 'ناشناس'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {r.user?.email ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground hidden md:table-cell max-w-xs">
                        <p className="truncate">{r.survey_title ?? r.survey}</p>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground hidden lg:table-cell">
                        {formatDateTime(r.started_at)}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground hidden lg:table-cell">
                        {formatDateTime(r.submitted_at)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={r.status === 'SUBMITTED' ? 'success' : 'muted'}>
                          {r.status === 'SUBMITTED' ? 'ارسال‌شده' : 'پیش‌نویس'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-left">
                        <Link
                          href={`/responses/${r.id}`}
                          className="p-1.5 inline-flex rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="مشاهده جزئیات"
                        >
                          <Eye size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function ResponsesPage() {
  return (
    <RoleGuard roles={['admin', 'creator']}>
      <ResponsesContent />
    </RoleGuard>
  );
}