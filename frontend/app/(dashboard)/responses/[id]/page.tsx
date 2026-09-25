'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Download, Loader2, User, Clock, CheckCircle2,
  AlertCircle, FileText, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

import { responsesApi } from '@/features/responses/api';
import type { AnswerRecord, SurveyResponse } from '@/features/responses/types';
import { surveysApi } from '@/features/surveys/api';
import type { SurveyDetail } from '@/features/surveys/types';
import { AnswerAccordion } from '@/features/responses/components/answer-accordion';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { PageLoader } from '@/shared/components/ui/spinner';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import { downloadResponseAsPDF } from '@/shared/lib/export/pdf';
import { getErrorMessage } from '@/shared/lib/api/client';
import { formatDateTime, toFa } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Content
// ═════════════════════════════════════════════════════════════════

function ResponseDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [response, setResponse] = useState<SurveyResponse | null>(null);
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // ── Load response + survey ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    responsesApi
      .detail(params.id)
      .then(async (res) => {
        if (cancelled) return;
        const s = await surveysApi.detail(res.survey);
        if (cancelled) return;
        setResponse(res);
        setSurvey(s);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // ── Export PDF ─────────────────────────────────────────────
  const handleExportPDF = useCallback(() => {
    if (!survey || !response) return;

    setExporting(true);
    try {
      const answersMap: Record<string, AnswerRecord> = {};
      for (const a of response.answers) {
        answersMap[a.question] = a;
      }

      const answerable = survey.questions.filter(
        (q) => !['TEXT_BLOCK', 'SECTION'].includes(q.type),
      );

      downloadResponseAsPDF({
        surveyTitle: survey.title,
        respondent: response.user?.full_name ?? 'ناشناس',
        respondentEmail: response.user?.email,
        status: response.status === 'SUBMITTED' ? 'ارسال‌شده' : 'پیش‌نویس',
        startedAt: response.started_at,
        submittedAt: response.submitted_at,
        completionTime: response.completion_time,
        questions: survey.questions,
        answers: answersMap,
        totalAnswerable: answerable.length,
      });

      toast.success('پنجره چاپ باز شد — Save as PDF را بزنید');
    } catch (err) {
      console.error('[export PDF]', err);
      toast.error('خطا در ساخت PDF');
    } finally {
      setExporting(false);
    }
  }, [survey, response]);

  // ── Loading ────────────────────────────────────────────────
  if (loading) return <PageLoader />;

  // ── Error ──────────────────────────────────────────────────
  if (error || !response || !survey) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent>
            <EmptyState
              icon={AlertCircle}
              title="پاسخ یافت نشد"
              description={error ?? 'این پاسخ وجود ندارد یا دسترسی به آن ندارید.'}
              action={
                <Button
                  variant="outline"
                  onClick={() => router.push('/responses')}
                >
                  بازگشت به لیست پاسخ‌ها
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Build data ─────────────────────────────────────────────
  const answersMap = Object.fromEntries(
    response.answers.map((a) => [a.question, a]),
  );

  const isSubmitted = response.status === 'SUBMITTED';
  const completionTime = response.completion_time
    ? formatDuration(response.completion_time)
    : '—';

  const answerableCount = survey.questions.filter(
    (q) => !['TEXT_BLOCK', 'SECTION'].includes(q.type),
  ).length;

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <Link
            href="/responses"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowRight size={12} /> بازگشت به لیست پاسخ‌ها
          </Link>
          <h1 className="text-2xl font-bold truncate">{survey.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            پاسخ ارسالی ·{' '}
            <span className="font-mono text-xs">
              #{response.id.slice(0, 8)}
            </span>
          </p>
        </div>

        <Button
          variant="outline"
          size="md"
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
      </div>

      {/* Meta cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetaCard
          icon={User}
          label="پاسخ‌دهنده"
          value={
            response.user
              ? response.user.full_name || response.user.email
              : 'ناشناس'
          }
          hint={response.user?.email}
          color="bg-blue-500/10 text-blue-600"
        />
        <MetaCard
          icon={isSubmitted ? CheckCircle2 : AlertCircle}
          label="وضعیت"
          value={isSubmitted ? 'ارسال‌شده' : 'پیش‌نویس'}
          color={
            isSubmitted
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-amber-500/10 text-amber-600'
          }
        />
        <MetaCard
          icon={Calendar}
          label="زمان ارسال"
          value={
            response.submitted_at
              ? formatDateTime(response.submitted_at)
              : '—'
          }
          color="bg-violet-500/10 text-violet-600"
        />
        <MetaCard
          icon={Clock}
          label="مدت زمان"
          value={completionTime}
          color="bg-amber-500/10 text-amber-600"
        />
      </div>

      {/* Status banner */}
      <div className="p-4 rounded-2xl border border-border bg-card flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {toFa(response.answers.length)} پاسخ ثبت شده از{' '}
            {toFa(answerableCount)} سوال
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            شروع: {formatDateTime(response.started_at)}
          </p>
        </div>
        <Badge variant={isSubmitted ? 'success' : 'warning'}>
          {isSubmitted ? 'کامل' : 'ناتمام'}
        </Badge>
      </div>

      {/* Answers */}
      <div>
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-primary" />
          پاسخ‌ها
        </h2>
        <AnswerAccordion
          questions={survey.questions}
          answers={answersMap}
        />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Small components
// ═════════════════════════════════════════════════════════════════

function MetaCard({
  icon: Icon,
  label,
  value,
  hint,
  color,
}: {
  icon: typeof User;
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}
        >
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-sm font-semibold truncate">{value}</p>
          {hint && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {hint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════

/** Format backend duration "HH:MM:SS.ffffff" to human readable. */
function formatDuration(duration: string): string {
  try {
    const parts = duration.split(' ');
    const timePart = parts[parts.length - 1];
    const [hStr, mStr, sStr] = timePart.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const s = Math.floor(parseFloat(sStr) || 0);

    if (h > 0) return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
    if (m > 0) return `${toFa(m)} دقیقه و ${toFa(s)} ثانیه`;
    return `${toFa(s)} ثانیه`;
  } catch {
    return '—';
  }
}

// ═════════════════════════════════════════════════════════════════
// Page wrapper
// ═════════════════════════════════════════════════════════════════

export default function ResponseDetailPage() {
  return (
    <RoleGuard roles={['admin', 'creator']}>
      <ResponseDetailContent />
    </RoleGuard>
  );
}