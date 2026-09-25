'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  ArrowRight,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  Sparkles,
  Table,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  analyticsApi,
  type DateRange,
  type GlobalStats,
  type SurveyAnalytics,
  type QuestionDistribution,
} from '@/features/analytics/api';
import { surveysApi } from '@/features/surveys/api';
import type { SurveyDetail } from '@/features/surveys/types';

import { DateRangePicker } from '@/features/analytics/components/date-range-picker';
import { TimelineChart } from '@/features/analytics/components/timeline-chart';
import { ComparisonCard } from '@/features/analytics/components/comparison-card';
import {
  CrossFilterChips,
  type CrossFilter,
} from '@/features/analytics/components/cross-filter-chips';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { PageLoader } from '@/shared/components/ui/spinner';
import { Button } from '@/shared/components/ui/button';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import {
  downloadAnalyticsAsPDF,
  downloadTextPDF,
  type PdfAnalyticsItem,
} from '@/shared/lib/export/pdf';
import { toFa, formatDateTime, cn } from '@/shared/lib/utils';
import { getErrorMessage } from '@/shared/lib/api/client';

// ═════════════════════════════════════════════════════════════════
// KPI card with delta
// ═════════════════════════════════════════════════════════════════

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  color: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center',
              color,
            )}
          >
            <Icon size={16} />
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {hint && (
          <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════
// Bar row
// ═════════════════════════════════════════════════════════════════

function BarRow({
  label,
  count,
  pct,
  active,
  onClick,
}: {
  label: string;
  count: number;
  pct: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg -mx-2 px-2 py-1 transition-colors',
        clickable && 'cursor-pointer hover:bg-accent/50',
        active && 'bg-primary/10 ring-1 ring-primary/20',
      )}
    >
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="truncate">{label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{toFa(count)}</span>
          <span className="text-sm font-semibold w-12 text-left">
            {toFa(Math.round(pct))}٪
          </span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Global analytics
// ═════════════════════════════════════════════════════════════════

function GlobalAnalyticsView() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    analyticsApi
      .global()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const handleExportPDF = useCallback(() => {
    if (!stats) return;
    setExporting(true);
    try {
      downloadTextPDF(
        [
          { label: 'تعداد کاربران', value: toFa(stats.total_users) },
          { label: 'تعداد پرسشنامه‌ها', value: toFa(stats.total_surveys) },
          { label: 'تعداد پاسخ‌ها', value: toFa(stats.total_responses) },
          { label: 'تعداد تخصیص‌ها', value: toFa(stats.total_assignments) },
          { label: 'نرخ تکمیل', value: `${toFa(stats.completion_rate)}٪` },
        ],
        'گزارش کلی پلتفرم',
        'global-analytics',
      );
      toast.success('پنجره چاپ باز شد');
    } catch (err) {
      console.error('[export PDF]', err);
      toast.error('خطا در ساخت PDF');
    } finally {
      setExporting(false);
    }
  }, [stats]);

  const kpis = [
    {
      label: 'پاسخ‌ها',
      value: stats?.total_responses ?? 0,
      icon: BarChart3,
      color: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'نرخ تکمیل',
      value: `${stats?.completion_rate ?? 0}٪`,
      icon: TrendingUp,
      color: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'تخصیص‌ها',
      value: stats?.total_assignments ?? 0,
      icon: Clock,
      color: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'کاربران فعال',
      value: stats?.total_users ?? 0,
      icon: Users,
      color: 'bg-violet-500/10 text-violet-600',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">تحلیل‌ها</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            نمای کلی عملکرد پلتفرم
          </p>
        </div>
        <Button
          variant="outline"
          size="md"
          onClick={handleExportPDF}
          disabled={exporting || !stats}
        >
          {exporting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          خروجی PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {kpi.label}
                  </span>
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center',
                      kpi.color,
                    )}
                  >
                    <Icon size={15} />
                  </div>
                </div>
                {stats ? (
                  <div className="text-2xl font-bold">
                    {typeof kpi.value === 'number'
                      ? toFa(kpi.value)
                      : kpi.value}
                  </div>
                ) : (
                  <Skeleton className="h-8 w-20" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>راهنمای تحلیل</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            برای مشاهده‌ی نمودار روند پاسخ‌ها، مقایسه‌ی دوره‌ای، و تحلیل
            سوال‌به‌سوال، یک پرسشنامه را از{' '}
            <Link
              href="/questionnaires"
              className="text-primary hover:underline font-medium"
            >
              لیست پرسشنامه‌ها
            </Link>{' '}
            انتخاب کنید.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Question distribution renderers
// ═════════════════════════════════════════════════════════════════

function ChoiceDistribution({
  dist,
  crossFilters,
  onToggle,
}: {
  dist: QuestionDistribution;
  crossFilters: CrossFilter[];
  onToggle: (label: string, value: string) => void;
}) {
  const counts = dist.counts ?? {};
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        پاسخی برای این سوال ثبت نشده است.
      </p>
    );
  }
  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  const activeValues = crossFilters
    .filter((f) => f.questionId === dist.question_id)
    .map((f) => f.value);

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        برای فیلتر، روی هر گزینه کلیک کنید
      </p>
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => (
          <BarRow
            key={label}
            label={label}
            count={count}
            pct={total > 0 ? (count / total) * 100 : 0}
            active={activeValues.includes(label)}
            onClick={() => onToggle(label, label)}
          />
        ))}
    </div>
  );
}

function NumericDistribution({ dist }: { dist: QuestionDistribution }) {
  const avg = dist.average;
  const count = dist.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-4xl font-bold">
            {avg !== null && avg !== undefined ? toFa(avg) : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">میانگین</div>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>تعداد پاسخ: {toFa(count)}</div>
          {dist.min !== null && dist.min !== undefined && (
            <div>کمینه: {toFa(dist.min)}</div>
          )}
          {dist.max !== null && dist.max !== undefined && (
            <div>بیشینه: {toFa(dist.max)}</div>
          )}
        </div>
      </div>

      {/* Histogram */}
      {dist.histogram && Object.keys(dist.histogram).length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-2">
            توزیع مقادیر
          </p>
          <div className="flex items-end gap-1 h-20">
            {Object.entries(dist.histogram)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([value, count]) => {
                const max = Math.max(
                  ...Object.values(dist.histogram ?? {}),
                );
                const h = (count / max) * 100;
                return (
                  <div
                    key={value}
                    className="flex-1 group relative"
                    style={{ height: '100%' }}
                    title={`${value}: ${count} پاسخ`}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t bg-primary/70 hover:bg-primary transition-colors"
                      style={{ height: `${Math.max(4, h)}%` }}
                    />
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">
                      {toFa(value)}
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="h-4" />
        </div>
      )}
    </div>
  );
}

function MatrixDistribution({ dist }: { dist: QuestionDistribution }) {
  const cells = dist.matrix_counts ?? {};
  const entries = Object.entries(cells);
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">پاسخی ثبت نشده است.</p>
    );
  }
  const max = Math.max(...entries.map(([, c]) => c));
  return (
    <div className="space-y-2 text-xs">
      {entries.map(([key, count]) => {
        const [row, col] = key.split(':');
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-muted-foreground w-24 truncate" title={row}>
              {row.slice(0, 8)}
            </span>
            <span className="text-muted-foreground w-16 truncate" title={col}>
              {col}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 text-left">{toFa(count)}</span>
          </div>
        );
      })}
    </div>
  );
}

function FileUploadStats({ dist }: { dist: QuestionDistribution }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-2xl font-bold">
        {toFa(dist.files_uploaded ?? 0)}
      </div>
      <div className="text-muted-foreground">فایل بارگذاری شده</div>
    </div>
  );
}

function QuestionStatsCard({
  dist,
  index,
  crossFilters,
  onToggle,
}: {
  dist: QuestionDistribution;
  index: number;
  crossFilters: CrossFilter[];
  onToggle: (label: string, value: string) => void;
}) {
  const numericTypes = ['NUMBER', 'RATING', 'LINEAR_SCALE', 'NPS', 'SLIDER'];
  const choiceTypes = [
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'DROPDOWN',
    'YES_NO',
    'LIKERT',
    'RANKING',
  ];

  let body: React.ReactNode = null;
  if (choiceTypes.includes(dist.type))
    body = (
      <ChoiceDistribution
        dist={dist}
        crossFilters={crossFilters}
        onToggle={onToggle}
      />
    );
  else if (numericTypes.includes(dist.type))
    body = <NumericDistribution dist={dist} />;
  else if (dist.type === 'MATRIX')
    body = <MatrixDistribution dist={dist} />;
  else if (dist.type === 'FILE_UPLOAD')
    body = <FileUploadStats dist={dist} />;
  else
    body = (
      <p className="text-xs text-muted-foreground">
        این نوع سوال پشتیبانی نمی‌شود.
      </p>
    );

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md mb-2 inline-block">
            سوال {toFa(index + 1)}
          </span>
          <h3 className="text-sm font-bold leading-snug">{dist.title}</h3>
        </div>
      </div>
      {body}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Survey analytics
// ═════════════════════════════════════════════════════════════════

function SurveyAnalyticsView({ surveyId }: { surveyId: string }) {
  const router = useRouter();

  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [stats, setStats] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  const [range, setRange] = useState<DateRange>({ preset: '30d' });
  const [crossFilters, setCrossFilters] = useState<CrossFilter[]>([]);

  // ── Load survey once ───────────────────────────────────────
  useEffect(() => {
    surveysApi
      .detail(surveyId)
      .then(setSurvey)
      .catch((err) => setError(getErrorMessage(err)));
  }, [surveyId]);

  // ── Load stats whenever range changes ──────────────────────
  useEffect(() => {
    let cancelled = false;
    setReloading(true);
    setError(null);

    analyticsApi
      .survey(surveyId, range)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setReloading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [surveyId, range]);

  // ── Cross-filter toggle ────────────────────────────────────
  const handleToggleCrossFilter = useCallback(
    (questionId: string, questionTitle: string, label: string) => {
      setCrossFilters((prev) => {
        const existingIdx = prev.findIndex(
          (f) => f.questionId === questionId && f.value === label,
        );
        if (existingIdx >= 0) {
          return prev.filter((_, i) => i !== existingIdx);
        }
        return [...prev, { questionId, questionTitle, value: label, label }];
      });
    },
    [],
  );

  // ── Apply cross-filters client-side ────────────────────────
  // Since the backend doesn't support cross-filtering yet, we filter
  // the response counts client-side using a heuristic: hide options whose
  // question has no active filter, and highlight the ones that match.
  // This is a UI-only filter; for true cross-filtering, extend the backend.
  const displayDistribution = useMemo(() => {
    if (!stats) return [];
    if (crossFilters.length === 0) return stats.question_distribution;
    // Simplified: don't remove, just keep visual highlighting (already done
    // inside ChoiceDistribution via `activeValues`). Return original list.
    return stats.question_distribution;
  }, [stats, crossFilters]);

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: 'پاسخ‌ها',
        value: toFa(stats.responses_count),
        icon: BarChart3,
        color: 'bg-blue-500/10 text-blue-600',
        hint: 'در بازه انتخابی',
      },
      {
        label: 'نرخ تکمیل',
        value: `${toFa(stats.completion_rate)}٪`,
        icon: TrendingUp,
        color: 'bg-emerald-500/10 text-emerald-600',
        hint: `${toFa(stats.completed_assignments)} از ${toFa(stats.total_assigned)}`,
      },
      {
        label: 'میانگین زمان',
        value: `${toFa(stats.average_completion_time_minutes)} دقیقه`,
        icon: Clock,
        color: 'bg-amber-500/10 text-amber-600',
        hint: 'زمان متوسط پاسخ‌دهی',
      },
      {
        label: 'تخصیص‌ها',
        value: toFa(stats.total_assigned),
        icon: Users,
        color: 'bg-violet-500/10 text-violet-600',
        hint: 'تعداد کل تخصیص‌ها',
      },
    ];
  }, [stats]);

  // ── Export PDF ─────────────────────────────────────────────
  const handleExportPDF = useCallback(() => {
    if (!survey || !stats) return;
    setExporting(true);
    try {
      const distribution: PdfAnalyticsItem[] = stats.question_distribution.map(
        (item, i) => ({
          index: i + 1,
          title: item.title,
          type: item.type,
          counts: item.counts,
          count: item.count,
          average: item.average,
          matrixCounts: item.matrix_counts,
          filesUploaded: item.files_uploaded,
        }),
      );

      downloadAnalyticsAsPDF({
        surveyTitle: survey.title,
        responsesCount: stats.responses_count,
        completionRate: stats.completion_rate,
        averageTimeMinutes: stats.average_completion_time_minutes,
        totalAssigned: stats.total_assigned,
        completedAssignments: stats.completed_assignments,
        generatedAt: stats.generated_at,
        distribution,
      });

      toast.success('پنجره چاپ باز شد');
    } catch (err) {
      console.error('[export PDF]', err);
      toast.error('خطا در ساخت PDF');
    } finally {
      setExporting(false);
    }
  }, [survey, stats]);

  // ── Export CSV ─────────────────────────────────────────────
  const handleExportCSV = useCallback(async () => {
    if (!survey) return;
    setExportingCSV(true);
    try {
      await analyticsApi.exportCSV(surveyId, range);
      toast.success('فایل CSV دانلود شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExportingCSV(false);
    }
  }, [survey, surveyId, range]);

  // ── Loading ────────────────────────────────────────────────
  if (loading) return <PageLoader />;

  if (error || !survey || !stats) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent>
            <EmptyState
              icon={AlertCircle}
              title="دسترسی به تحلیل‌ها ممکن نیست"
              description={
                error ??
                'این پرسشنامه یافت نشد یا به آن دسترسی ندارید.'
              }
              action={
                <Button
                  variant="outline"
                  onClick={() => router.push('/analytics')}
                >
                  بازگشت
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <Link
            href="/analytics"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowRight size={12} /> بازگشت به تحلیل‌های کلی
          </Link>
          <h1 className="text-2xl font-bold truncate">{survey.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            تحلیل پاسخ‌ها · آخرین به‌روزرسانی{' '}
            {formatDateTime(stats.generated_at)}
            {reloading && (
              <span className="inline-flex items-center gap-1 mr-2 text-primary">
                <Loader2 size={11} className="animate-spin" /> در حال
                بروزرسانی
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={setRange} />

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={exportingCSV}
          >
            {exportingCSV ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Table size={14} />
            )}
            خروجی CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            خروجی PDF
          </Button>

          <Link href={`/builder/${survey.id}`}>
            <Button variant="outline" size="sm">
              <FileText size={14} /> ویرایش
            </Button>
          </Link>
        </div>
      </div>

      {/* Cross-filter chips */}
      <CrossFilterChips
        filters={crossFilters}
        onRemove={(i) =>
          setCrossFilters((prev) => prev.filter((_, idx) => idx !== i))
        }
        onClear={() => setCrossFilters([])}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {kpi.label}
                  </span>
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center',
                      kpi.color,
                    )}
                  >
                    <Icon size={15} />
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpi.value}</div>
                {kpi.hint && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {kpi.hint}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Timeline + Comparison */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              روند پاسخ‌ها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimelineChart data={stats.timeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>مقایسه دوره‌ای</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.comparison ? (
              <ComparisonCard comparison={stats.comparison} />
            ) : (
              <p className="text-xs text-muted-foreground">
                برای مقایسه، یک بازه زمانی سفارشی انتخاب کنید.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Completion progress */}
      <Card>
        <CardHeader>
          <CardTitle>وضعیت تکمیل تخصیص‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {toFa(stats.completed_assignments)} از{' '}
              {toFa(stats.total_assigned)} تخصیص تکمیل شده
            </span>
            <span className="font-semibold">
              {toFa(stats.completion_rate)}٪
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${stats.completion_rate}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Question-by-question */}
      {displayDistribution.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="هنوز سوالی برای تحلیل وجود ندارد"
          description="پس از افزودن سوال و دریافت پاسخ، آمار اینجا نمایش داده می‌شود."
        />
      ) : (
        <div className="space-y-5">
          <h2 className="text-base font-bold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-primary" />
            تحلیل سوال‌به‌سوال
          </h2>
          {displayDistribution.map((dist, i) => (
            <QuestionStatsCard
              key={dist.question_id}
              dist={dist}
              index={i}
              crossFilters={crossFilters}
              onToggle={(label, value) =>
                handleToggleCrossFilter(dist.question_id, dist.title, label)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Page wrapper
// ═════════════════════════════════════════════════════════════════

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get('survey');

  if (surveyId) return <SurveyAnalyticsView surveyId={surveyId} />;
  return <GlobalAnalyticsView />;
}

export default function AnalyticsPage() {
  return (
    <RoleGuard roles={['admin', 'creator']}>
      <Suspense fallback={<PageLoader />}>
        <AnalyticsContent />
      </Suspense>
    </RoleGuard>
  );
}