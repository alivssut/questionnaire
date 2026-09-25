'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Save,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { surveysApi } from '@/features/surveys/api';
import type { Question, SurveyDetail } from '@/features/surveys/types';
import { assignmentsApi } from '@/features/assignments/api';
import type { Assignment } from '@/features/assignments/types';
import { responsesApi } from '@/features/responses/api';
import type { AnswerFile, SurveyResponse } from '@/features/responses/types';
import {
  QuestionRenderer,
  isAnswerValid,
  type AnswerValue,
} from '@/features/answer/components/question-renderer';
import { NON_ANSWERABLE } from '@/features/builder/question-types';
import {
  toBackendValue,
  fromBackendValue,
  isEmpty,
} from '@/features/answer/utils';

import { Button } from '@/shared/components/ui/button';
import { PageLoader, Spinner } from '@/shared/components/ui/spinner';
import { getErrorMessage } from '@/shared/lib/api/client';
import { toFa, cn } from '@/shared/lib/utils';

const isContentType = (q: Question) => NON_ANSWERABLE.includes(q.type);

// ═══════════════════════════════════════════════════════════════
// Main content
// ═══════════════════════════════════════════════════════════════

function AnswerContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const assignmentId = searchParams.get('assignment');

  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [existingResponse, setExistingResponse] = useState<SurveyResponse | null>(null);

  const [review, setReview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Load survey + draft + assignment ───────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBlockedMessage(null);

    Promise.all([
      surveysApi.detail(params.id),
      responsesApi.myDraft(params.id).catch(() => null),
      assignmentId
        ? assignmentsApi.detail(assignmentId).catch(() => null)
        : Promise.resolve<Assignment | null>(null),
    ])
      .then(([surveyData, draft, assignment]) => {
        if (cancelled) return;

        if (assignment) {
          const isPastDue =
            assignment.is_past_due || assignment.status === 'OVERDUE';

          if (
            assignment.status === 'COMPLETED' &&
            draft?.status !== 'SUBMITTED'
          ) {
            setBlockedMessage('شما قبلاً به این پرسشنامه پاسخ داده‌اید.');
            setLoading(false);
            return;
          }

          if (isPastDue) {
            setBlockedMessage(
              'مهلت پاسخ به این پرسشنامه گذشته است. برای تمدید با مدیر سیستم تماس بگیرید.',
            );
            setLoading(false);
            return;
          }
        }

        if (draft && draft.status === 'SUBMITTED') {
          setSurvey(surveyData);
          setExistingResponse(draft);
          setSubmitted(true);
          setLoading(false);
          return;
        }

        setSurvey(surveyData);
        setExistingResponse(draft);

        if (draft && draft.answers.length > 0) {
          const map: Record<string, AnswerValue> = {};
          for (const a of draft.answers) {
            const q = surveyData.questions.find((qq) => qq.id === a.question);
            if (!q) continue;
            map[a.question] = fromBackendValue(q, a.value, a.files);
          }
          setAnswers(map);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(getErrorMessage(err));
        router.replace('/my-questionnaires');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.id, assignmentId, router]);

  // ── Question list (content + answerable, in order) ─────────
  const allQuestions = useMemo(() => survey?.questions ?? [], [survey]);
  const answerable = useMemo(
    () => allQuestions.filter((q) => !isContentType(q)),
    [allQuestions],
  );

  const totalSteps = allQuestions.length;
  const totalAnswerable = answerable.length;

  const question = allQuestions[current];
  const isContent = question ? isContentType(question) : false;
  const value = question && !isContent ? answers[question.id] ?? null : null;

  // Progress: how many answerable questions have non-empty values
  const answeredCount = useMemo(
    () => answerable.filter((q) => !isEmpty(q, answers[q.id] ?? null)).length,
    [answerable, answers],
  );

  const progress =
    totalAnswerable > 0 ? (answeredCount / totalAnswerable) * 100 : 0;

  // Can continue? Content: always yes. Answerable: run validation.
  const canContinue = question
    ? isContent
      ? true
      : isAnswerValid(question, value)
    : false;

  // Display number for the current question (only counts answerable)
  const displayNumber = useMemo(() => {
    if (!question) return 0;
    if (isContentType(question)) return 0;
    return allQuestions
      .slice(0, current + 1)
      .filter((q) => !isContentType(q)).length;
  }, [allQuestions, current, question]);

  // ── Handlers ───────────────────────────────────────────────
  const setAnswer = useCallback(
    (v: AnswerValue) => {
      if (!question || isContentType(question)) return;
      setAnswers((prev) => ({ ...prev, [question.id]: v }));
    },
    [question],
  );

  const handleNext = () => {
    if (current < totalSteps - 1) setCurrent((c) => c + 1);
    else setReview(true);
  };

  const handleBack = () => {
    if (review) setReview(false);
    else if (current > 0) setCurrent((c) => c - 1);
  };

  // ── Persist draft ──────────────────────────────────────────
  const persistDraft = useCallback(async (): Promise<string | null> => {
    if (!survey) return null;

    const answersPayload = answerable
      .map((q) => {
        const v = answers[q.id];
        if (v === null || v === undefined) return null;
        if (isEmpty(q, v)) return null;
        return { question: q.id, value: toBackendValue(q, v) };
      })
      .filter(
        (x): x is { question: string; value: Record<string, unknown> } =>
          x !== null,
      );

    const res = await responsesApi.saveDraft({
      survey: survey.id,
      assignment: assignmentId,
      answers: answersPayload,
    });
    setExistingResponse(res);
    return res.id;
  }, [survey, answerable, answers, assignmentId]);

  const autoSave = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!survey) return false;
      setSaving(true);
      try {
        if (assignmentId) {
          try {
            await assignmentsApi.start(assignmentId);
          } catch {
            /* ignore */
          }
        }
        await persistDraft();
        return true;
      } catch (err) {
        if (!silent) {
          if (err instanceof Error && err.message) {
            toast.error(err.message);
          } else {
            toast.error(getErrorMessage(err));
          }
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [survey, assignmentId, persistDraft],
  );

  // Content blocks don't need saving — just navigate.
  const handleContinue = async () => {
    if (isContent) {
      handleNext();
      return;
    }
    const ok = await autoSave();
    if (ok) handleNext();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const responseId = existingResponse?.id ?? (await persistDraft());
      if (!responseId) {
        toast.error('ذخیره پاسخ‌ها با خطا مواجه شد');
        setSubmitting(false);
        return;
      }
      await responsesApi.submit(responseId);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof Error && err.message) {
        toast.error(err.message);
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Render states
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">
          در حال بارگذاری پرسشنامه...
        </p>
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={36} className="text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-3">امکان پاسخ‌دهی نیست</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {blockedMessage}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              variant="secondary"
              onClick={() => router.push('/my-questionnaires')}
            >
              بازگشت به پرسشنامه‌های من
            </Button>
            <Button onClick={() => router.push('/dashboard')}>داشبورد</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">پرسشنامه یافت نشد.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-purple-500/5 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={36} className="text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold mb-3">تمام شد!</h1>
          <p className="text-muted-foreground mb-8">
            از پاسخ شما سپاسگزاریم. پاسخ‌های شما با موفقیت ثبت شد.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              variant="secondary"
              onClick={() => router.push('/dashboard')}
            >
              بازگشت به داشبورد
            </Button>
            <Button onClick={() => router.push('/my-questionnaires')}>
              پرسشنامه‌های من
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (allQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-muted-foreground mb-4">
            این پرسشنامه هنوز محتوایی ندارد.
          </p>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            بازگشت
          </Button>
        </div>
      </div>
    );
  }

  // ── Review screen ──────────────────────────────────────────
  if (review) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-card border-b border-border px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-primary-foreground" />
          </div>
          <span className="text-sm font-bold">بازبینی پاسخ‌ها</span>
        </div>

        <div className="max-w-2xl mx-auto p-6 space-y-4">
          <h2 className="text-xl font-bold mb-6">قبل از ارسال بررسی کنید</h2>

          {answerable.map((q, i) => {
            const a = answers[q.id];
            const display = renderAnswerDisplay(q, a);
            return (
              <div
                key={q.id}
                className="bg-card rounded-2xl border border-border p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-primary mb-1">
                      سوال {toFa(i + 1)}
                    </p>
                    <p className="text-sm font-medium mb-2">{q.title}</p>
                    <p className="text-base text-muted-foreground break-words">
                      {display}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const idx = allQuestions.findIndex((x) => x.id === q.id);
                      if (idx >= 0) setCurrent(idx);
                      setReview(false);
                    }}
                    className="text-xs text-primary hover:underline font-medium flex-shrink-0"
                  >
                    ویرایش
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-4">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowRight size={16} /> بازگشت
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              ارسال پرسشنامه
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Zap size={13} className="text-primary-foreground" />
          </div>
          <span className="text-sm font-bold hidden sm:block">FORMly</span>
        </div>
        <div className="flex items-center gap-4">
          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Save size={11} /> در حال ذخیره...
            </span>
          )}
          <span className="text-sm text-muted-foreground font-medium">
            {toFa(current + 1)} / {toFa(totalSteps)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question area */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-xl animate-in fade-in duration-200"
          key={question?.id}
        >
          <div className="mb-6">
            {isContent ? (
              <span className="text-xs font-bold text-primary uppercase tracking-widest">
                {question.type === 'SECTION' ? 'بخش جدید' : 'توضیحات'}
              </span>
            ) : (
              <span className="text-xs font-bold text-primary uppercase tracking-widest">
                سوال {toFa(displayNumber)}
              </span>
            )}
          </div>

          {!isContent && question && (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 leading-snug text-balance">
                {question.title}
              </h2>
              {question.description && (
                <p className="text-muted-foreground mb-8 text-base leading-relaxed">
                  {question.description}
                </p>
              )}
              {!question.description && <div className="mb-8" />}
            </>
          )}

          {isContent && <div className="mb-6" />}

          {question && (
            <QuestionRenderer
              question={question}
              surveyId={survey.id}
              value={value}
              onChange={setAnswer}
            />
          )}

          {!isContent && question?.required && (
            <p className="text-xs text-muted-foreground mt-4">
              <span className="text-destructive">*</span> این سوال اجباری است
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border">
        {/* Step indicator strip */}
        <div className="px-6 pt-3">
          <div className="flex items-center gap-1 max-w-2xl mx-auto flex-wrap">
            {allQuestions.map((q, i) => {
              const content = NON_ANSWERABLE.includes(q.type);
              const isCurrent = i === current;
              const isPast = i < current;

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrent(i)}
                  title={
                    content
                      ? q.type === 'SECTION'
                        ? `بخش: ${q.title}`
                        : 'محتوا'
                      : `سوال ${q.title}`
                  }
                  className={cn(
                    'rounded-full transition-all hover:opacity-80 flex-shrink-0',
                    content
                      ? cn(
                          'h-1.5 w-1.5',
                          isCurrent
                            ? 'bg-primary scale-[1.8]'
                            : isPast
                            ? 'bg-muted-foreground/40'
                            : 'bg-muted-foreground/20',
                        )
                      : cn(
                          'h-1.5',
                          isCurrent
                            ? 'w-7 bg-primary'
                            : isPast
                            ? 'w-4 bg-primary/60'
                            : 'w-2 bg-muted',
                        ),
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Main footer row */}
        <div className="flex items-center justify-between px-6 py-5">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={current === 0 || saving}
          >
            <ArrowRight size={16} /> قبلی
          </Button>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {isContent ? (
                <span className="text-primary">
                  {question?.type === 'SECTION' ? 'بخش جدید' : 'توضیحات'}
                </span>
              ) : (
                <>
                  سوال {toFa(displayNumber)} از {toFa(totalAnswerable)}
                </>
              )}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              مرحله {toFa(current + 1)} از {toFa(totalSteps)}
            </span>
          </div>

          <Button onClick={handleContinue} disabled={!canContinue || saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {current === totalSteps - 1 ? 'بازبینی' : 'بعدی'}
            <ArrowLeft size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function renderAnswerDisplay(q: Question, v: AnswerValue): string {
  if (v === null || v === undefined || v === '') return '—';

  if (q.type === 'FILE_UPLOAD') {
    const files = (v as AnswerFile[]) ?? [];
    if (files.length === 0) return '—';
    return files.map((f) => f.original_name).join('، ');
  }

  if (Array.isArray(v)) {
    return v
      .map((val) => {
        const opt = q.options.find((o) => o.value === val);
        return opt?.label ?? val;
      })
      .join('، ');
  }

  if (typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.keys(v as Record<string, string>);
    if (keys.length === 0) return '—';
    return `${toFa(keys.length)} ردیف پاسخ داده شده`;
  }

  if (typeof v === 'string') {
    const opt = q.options.find((o) => o.value === v);
    return opt?.label ?? v;
  }

  if (typeof v === 'number') {
    return toFa(v);
  }

  return String(v);
}

export default function AnswerPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AnswerContent />
    </Suspense>
  );
}