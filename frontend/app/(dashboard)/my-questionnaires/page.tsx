'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  Play,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Search,
  Eye,
} from 'lucide-react';

import { assignmentsApi } from '@/features/assignments/api';
import type { Assignment, AssignmentStatus } from '@/features/assignments/types';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Tabs } from '@/shared/components/ui/tabs';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { toFa, formatDate } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Config
// ═════════════════════════════════════════════════════════════════

type TabKey = 'ALL' | AssignmentStatus;

const statusCfg: Record<
  AssignmentStatus,
  { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }
> = {
  PENDING: { label: 'در انتظار', variant: 'info' },
  IN_PROGRESS: { label: 'در حال انجام', variant: 'warning' },
  COMPLETED: { label: 'تکمیل‌شده', variant: 'success' },
  OVERDUE: { label: 'منقضی', variant: 'danger' },
};

// ═════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════

export default function MyQuestionnairesPage() {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [tab, setTab] = useState<TabKey>('ALL');
  const [search, setSearch] = useState('');

  // ── Load assignments ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    assignmentsApi
      .mine()
      .then((r) => {
        if (!cancelled) setAssignments(r.results);
      })
      .catch(() => {
        if (!cancelled) setAssignments([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Tab counts ───────────────────────────────────────────────
  const counts = useMemo(() => {
    const list = assignments ?? [];
    return {
      ALL: list.length,
      PENDING: list.filter((a) => a.status === 'PENDING' && !a.is_past_due).length,
      IN_PROGRESS: list.filter((a) => a.status === 'IN_PROGRESS' && !a.is_past_due).length,
      COMPLETED: list.filter((a) => a.status === 'COMPLETED').length,
      OVERDUE: list.filter((a) => a.status === 'OVERDUE' || a.is_past_due).length,
    };
  }, [assignments]);

  // ── Filtered list ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = assignments ?? [];
    return list.filter((a) => {
      const isPastDue = a.status === 'OVERDUE' || a.is_past_due;

      // For OVERDUE tab, include both status OVERDUE and is_past_due.
      let matchesTab = false;
      if (tab === 'ALL') matchesTab = true;
      else if (tab === 'OVERDUE') matchesTab = isPastDue;
      else matchesTab = a.status === tab && !isPastDue;

      const matchesSearch =
        !search || a.survey_title.toLowerCase().includes(search.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [assignments, tab, search]);

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">پرسشنامه‌های من</h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          پرسشنامه‌هایی که برای پاسخ دادن به شما تخصیص داده شده است.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'ALL', label: 'همه', count: counts.ALL },
            { value: 'PENDING', label: 'در انتظار', count: counts.PENDING },
            { value: 'IN_PROGRESS', label: 'در حال انجام', count: counts.IN_PROGRESS },
            { value: 'COMPLETED', label: 'تکمیل‌شده', count: counts.COMPLETED },
            { value: 'OVERDUE', label: 'منقضی', count: counts.OVERDUE },
          ]}
        />

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
      </div>

      {/* Content */}
      {!assignments ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={
            tab === 'ALL'
              ? 'پرسشنامه‌ای برای شما وجود ندارد'
              : 'پرسشنامه‌ای در این وضعیت نیست'
          }
          description="وقتی پرسشنامه‌ای به شما تخصیص داده شود، اینجا نمایش داده می‌شود."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <AssignmentRow key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Row component
// ═════════════════════════════════════════════════════════════════

function AssignmentRow({ assignment: a }: { assignment: Assignment }) {
  const isPastDue = a.status === 'OVERDUE' || a.is_past_due;
  const isCompleted = a.status === 'COMPLETED';
  const isInProgress = a.status === 'IN_PROGRESS';

  const cfg = isPastDue ? statusCfg.OVERDUE : statusCfg[a.status];

  // `response_id` is populated by the backend for SUBMITTED responses.
  // See apps/q_assignments/api/v1/views.py — it's a correlated Subquery
  // on SurveyResponse (survey, user, SUBMITTED).
  const hasResponse = !!a.response_id;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* ── Left: info ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>

            {isPastDue && !isCompleted && (
              <Badge variant="danger" className="gap-1">
                <AlertCircle size={10} /> مهلت گذشته
              </Badge>
            )}

            {isCompleted && (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 size={10} /> اتمام
              </Badge>
            )}
          </div>

          <h3 className="text-base font-bold leading-snug mb-2">
            {a.survey_title}
          </h3>

          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              تخصیص: {formatDate(a.assigned_at)}
            </span>

            {a.due_date && (
              <span
                className={`flex items-center gap-1 ${
                  isPastDue && !isCompleted
                    ? 'text-destructive font-medium'
                    : ''
                }`}
              >
                <Clock size={11} />
                موعد: {formatDate(a.due_date)}
              </span>
            )}

            {a.completed_at && (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={11} />
                تکمیل: {formatDate(a.completed_at)}
              </span>
            )}
          </div>
        </div>

        {/* ── Right: action ──────────────────────────────────── */}
        <div className="flex-shrink-0">
          {isCompleted ? (
            hasResponse ? (
              // Completed + response submitted → link to view it.
              <Link href={`/responses/${a.response_id}`}>
                <Button variant="outline" size="md">
                  <Eye size={14} /> مشاهده پاسخ من
                </Button>
              </Link>
            ) : (
              // Defensive: completed but no submitted response found.
              // Shouldn't happen in practice, but keeps the UI honest
              // instead of leading to a 404.
              <Button variant="outline" size="md" disabled>
                <CheckCircle2 size={14} /> تکمیل‌شده
              </Button>
            )
          ) : isPastDue ? (
            <Button variant="outline" size="md" disabled>
              <AlertCircle size={14} /> منقضی شده
            </Button>
          ) : (
            <Link href={`/answer/${a.survey}?assignment=${a.id}`}>
              <Button variant="primary">
                {isInProgress ? (
                  <>
                    <RotateCw size={14} /> ادامه
                  </>
                ) : (
                  <>
                    <Play size={14} /> شروع
                  </>
                )}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}