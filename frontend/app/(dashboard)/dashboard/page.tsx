'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users, FileText, TrendingUp, CheckCircle, Plus, ArrowLeft,
  Activity, Clock, BookOpen, AlertCircle, Play, RotateCw,
} from 'lucide-react';

import { useAuth } from '@/shared/providers/auth-provider';
import { analyticsApi, type GlobalStats } from '@/features/analytics/api';
import { surveysApi } from '@/features/surveys/api';
import type { Survey } from '@/features/surveys/types';
import { assignmentsApi } from '@/features/assignments/api';
import type { Assignment, AssignmentStatus } from '@/features/assignments/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { SurveyStatusBadge } from '@/features/surveys/components/survey-status-badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { toFa, formatDate, formatRelative } from '@/shared/lib/utils';

// ─────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────

const assignmentStatusConfig: Record<
  AssignmentStatus,
  { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }
> = {
  PENDING: { label: 'در انتظار', variant: 'info' },
  IN_PROGRESS: { label: 'در حال انجام', variant: 'warning' },
  COMPLETED: { label: 'تکمیل‌شده', variant: 'success' },
  OVERDUE: { label: 'منقضی', variant: 'danger' },
};

// ─────────────────────────────────────────────────────────────────
// User dashboard
// ─────────────────────────────────────────────────────────────────

function UserDashboard({ userName }: { userName: string }) {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);

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

  const counts = useMemo(() => {
    const list = assignments ?? [];
    return {
      pending: list.filter((a) => a.status === 'PENDING' && !a.is_past_due).length,
      inProgress: list.filter((a) => a.status === 'IN_PROGRESS' && !a.is_past_due).length,
      completed: list.filter((a) => a.status === 'COMPLETED').length,
      overdue: list.filter((a) => a.status === 'OVERDUE' || a.is_past_due).length,
    };
  }, [assignments]);

  const actionable = useMemo(
    () =>
      (assignments ?? []).filter(
        (a) =>
          a.status !== 'COMPLETED' &&
          !a.is_past_due &&
          (a.status === 'PENDING' || a.status === 'IN_PROGRESS'),
      ),
    [assignments],
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">سلام {userName} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          {actionable.length === 0
            ? 'در حال حاضر پرسشنامه‌ای در انتظار شما نیست.'
            : `${toFa(actionable.length)} پرسشنامه در انتظار پاسخ شماست.`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="text-2xl font-bold text-blue-600 mb-0.5">
            {toFa(counts.pending)}
          </div>
          <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
            در انتظار
          </div>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="text-2xl font-bold text-amber-600 mb-0.5">
            {toFa(counts.inProgress)}
          </div>
          <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
            در حال انجام
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="text-2xl font-bold text-emerald-600 mb-0.5">
            {toFa(counts.completed)}
          </div>
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            تکمیل‌شده
          </div>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-2xl font-bold text-red-600 mb-0.5">
            {toFa(counts.overdue)}
          </div>
          <div className="text-sm font-medium text-red-700 dark:text-red-400">
            منقضی
          </div>
        </div>
      </div>

      {/* Actionable assignments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">پرسشنامه‌های در انتظار شما</h2>
          <Link
            href="/my-questionnaires"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            مشاهده همه <ArrowLeft size={12} />
          </Link>
        </div>

        {!assignments ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : actionable.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={BookOpen}
                title="همه‌چیز تکمیل شده!"
                description="در حال حاضر پرسشنامه‌ای برای پاسخ دادن وجود ندارد."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {actionable.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const isPastDue = assignment.is_past_due || assignment.status === 'OVERDUE';
  const isCompleted = assignment.status === 'COMPLETED';
  const isInProgress = assignment.status === 'IN_PROGRESS';

  const cfg = isPastDue
    ? assignmentStatusConfig.OVERDUE
    : assignmentStatusConfig[assignment.status];

  const canStart = !isPastDue && !isCompleted;

  return (
    <Card className="hover:shadow-md hover:border-primary/30 transition-all">
      <CardContent>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
              {isPastDue && !isCompleted && (
                <Badge variant="danger" className="gap-1">
                  <AlertCircle size={10} /> مهلت گذشته
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-bold leading-snug line-clamp-2">
              {assignment.survey_title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Clock size={12} />
          {assignment.due_date ? (
            <span className={isPastDue && !isCompleted ? 'text-destructive font-medium' : ''}>
              موعد: {formatDate(assignment.due_date)}
            </span>
          ) : (
            <span>بدون موعد</span>
          )}
        </div>

        {canStart ? (
          <Link href={`/answer/${assignment.survey}?assignment=${assignment.id}`}>
            <Button className="w-full">
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
        ) : (
          <Button variant="outline" className="w-full" disabled>
            {isCompleted ? (
              <>
                <CheckCircle size={14} /> تکمیل‌شده
              </>
            ) : (
              <>
                <AlertCircle size={14} /> مهلت گذشته
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// Admin / Creator dashboard
// ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1.5">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboard({ userName }: { userName: string }) {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [surveys, setSurveys] = useState<Survey[] | null>(null);

  useEffect(() => {
    if (isAdmin) {
      analyticsApi.global().then(setStats).catch(() => setStats(null));
    }
    surveysApi
      .list({ page_size: 5, ordering: '-updated_at' })
      .then((res) => setSurveys(res.results))
      .catch(() => setSurveys([]));
  }, [isAdmin]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">سلام {userName} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {isAdmin ? 'خلاصه‌ای از فعالیت پلتفرم' : 'پرسشنامه‌های شما'}
          </p>
        </div>
        <Link href="/questionnaires">
          <Button>
            <Plus size={16} /> پرسشنامه جدید
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {!stats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent>
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <KpiCard
                label="کاربران"
                value={toFa(stats.total_users)}
                icon={Users}
                color="bg-violet-500/10 text-violet-600"
              />
              <KpiCard
                label="پرسشنامه‌ها"
                value={toFa(stats.total_surveys)}
                icon={FileText}
                color="bg-blue-500/10 text-blue-600"
              />
              <KpiCard
                label="پاسخ‌ها"
                value={toFa(stats.total_responses)}
                icon={TrendingUp}
                color="bg-emerald-500/10 text-emerald-600"
              />
              <KpiCard
                label="نرخ تکمیل"
                value={`${toFa(stats.completion_rate)}٪`}
                icon={CheckCircle}
                color="bg-amber-500/10 text-amber-600"
              />
            </>
          )}
        </div>
      )}

      {/* Recent surveys + Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>آخرین پرسشنامه‌ها</CardTitle>
            <Link
              href="/questionnaires"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              مشاهده همه <ArrowLeft size={12} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {!surveys ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : surveys.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                هنوز پرسشنامه‌ای نساخته‌اید.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {surveys.slice(0, 4).map((s) => (
                  <Link
                    key={s.id}
                    href={`/builder/${s.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {toFa(s.questions_count)} سوال · {toFa(s.estimated_time_minutes)} دقیقه
                      </p>
                    </div>
                    <SurveyStatusBadge status={s.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>فعالیت‌های اخیر</CardTitle>
            {isAdmin && (
              <Link
                href="/activity"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                مشاهده همه <ArrowLeft size={12} />
              </Link>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 px-6 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Activity size={13} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">فعالیت</span> ثبت شد
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={10} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(new Date(Date.now() - i * 3600_000).toISOString())}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Wrapper
// ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isRegularUser =
    !user.is_admin && !user.permissions?.includes('can_create_survey');

  const name = user.first_name || user.full_name?.split(' ')[0] || 'کاربر';

  return isRegularUser ? (
    <UserDashboard userName={name} />
  ) : (
    <AdminDashboard userName={name} />
  );
}