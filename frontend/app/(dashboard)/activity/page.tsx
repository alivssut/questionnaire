'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, PenLine, Send, Users, CheckCircle, XCircle, Search,
} from 'lucide-react';

import { apiClient } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type { Paginated } from '@/shared/types';

import { Input } from '@/shared/components/ui/input';
import { Pagination, PAGE_SIZE_OPTIONS } from '@/shared/components/ui/pagination';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import { formatRelative, toFa } from '@/shared/lib/utils';

interface LogRow {
  id: string;
  user_email: string | null;
  action: string;
  object_type: string;
  object_id: string;
  description: string;
  created_at: string;
}

const iconMap: Record<string, typeof Activity> = {
  'survey.created': PenLine,
  'survey.published': Send,
  'survey.closed': XCircle,
  'assignment.created': Users,
  'response.submitted': CheckCircle,
};

const colorMap: Record<string, string> = {
  'survey.created': 'bg-blue-500/10 text-blue-600',
  'survey.published': 'bg-emerald-500/10 text-emerald-600',
  'survey.closed': 'bg-muted text-muted-foreground',
  'assignment.created': 'bg-amber-500/10 text-amber-600',
  'response.submitted': 'bg-violet-500/10 text-violet-600',
};

function ActivityContent() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, pageSize]);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Paginated<LogRow>>(endpoints.activity, {
        params: {
          page,
          page_size: pageSize,
          ordering: '-created_at',
          search: debounced || undefined,
        },
      });
      setLogs(data.results);
      setTotal(data.count);
    } catch {
      setLogs([]);
      setTotal(0);
    }
  }, [page, pageSize, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">رویدادها</h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          {toFa(total)} رویداد در مجموع
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی رویداد..."
            className="pr-9"
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="h-10 px-3 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{toFa(s)} / صفحه</option>
          ))}
        </select>
      </div>

      {!logs ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Activity} title="رویدادی ثبت نشده" />
      ) : (
        <>
          <div className="bg-card rounded-2xl border border-border divide-y divide-border">
            {logs.map((log) => {
              const Icon = iconMap[log.action] ?? Activity;
              const color = colorMap[log.action] ?? 'bg-muted text-muted-foreground';
              return (
                <div key={log.id} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-bold">{log.user_email ?? 'سیستم'}</span>{' '}
                      <span className="text-muted-foreground">{log.description || log.action}</span>
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatRelative(log.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <RoleGuard roles={['admin']}>
      <ActivityContent />
    </RoleGuard>
  );
}