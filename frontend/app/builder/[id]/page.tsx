'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Check, Eye, Loader2, Plus, Save, Send, Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { surveysApi, type QuestionPayload } from '@/features/surveys/api';
import type {
  Question,
  QuestionType,
  SurveyDetail,
} from '@/features/surveys/types';
import { ComponentLibrary } from '@/features/builder/components/component-library';
import { QuestionCard } from '@/features/builder/components/question-card';
import { PropertiesPanel } from '@/features/builder/components/properties-panel';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/ui/spinner';
import { getErrorMessage } from '@/shared/lib/api/client';
import { toFa } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Constants & helpers
// ═════════════════════════════════════════════════════════════════

const NON_ANSWERABLE: QuestionType[] = ['TEXT_BLOCK', 'SECTION'];
const CHOICE_TYPES: QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'DROPDOWN',
  'LIKERT',
  'RANKING',
];

/** Build a blank question of the given type. */
function createEmptyQuestion(
  type: QuestionType,
  order: number,
  surveyId: string,
): Question {
  const base: Question = {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    survey: surveyId,
    type,
    title:
      type === 'SECTION'
        ? 'بخش جدید'
        : type === 'TEXT_BLOCK'
        ? 'متن توضیحی'
        : 'سوال جدید',
    description: '',
    required: false,
    order,
    settings: type === 'RATING' ? { max: 5 } : {},
    system_list: null,
    options: [],
    matrix_rows: [],
    matrix_columns: [],
  };

  if (CHOICE_TYPES.includes(type) && type !== 'YES_NO') {
    base.options = [
      { id: 'o1', label: 'گزینه ۱', value: 'option_1', order: 0 },
      { id: 'o2', label: 'گزینه ۲', value: 'option_2', order: 1 },
    ];
  }

  if (type === 'MATRIX') {
    base.matrix_rows = [
      { id: 'r1', label: 'ردیف ۱', order: 0 },
      { id: 'r2', label: 'ردیف ۲', order: 1 },
    ];
    base.matrix_columns = [
      { id: 'c1', label: 'ستون ۱', value: 'col_1', order: 0 },
      { id: 'c2', label: 'ستون ۲', value: 'col_2', order: 1 },
    ];
  }

  return base;
}

/**
 * Convert a local Question into the payload expected by the backend.
 *
 * Backend rule: use EITHER `options` OR `system_list`, never both.
 * When `system_list` is set, we send `options: []` so the backend
 * deletes any stale manual options that may still exist in the DB
 * from a previous save.
 */
function toQuestionPayload(
  q: Question,
  surveyId: string,
  includeOrder: boolean,
): QuestionPayload {
  const payload: QuestionPayload = {
    survey: surveyId,
    type: q.type,
    title: q.title,
    description: q.description,
    required: q.required,
    settings: q.settings,
    system_list: q.system_list,
  };

  if (includeOrder) payload.order = q.order;

  // ── Choice types ────────────────────────────────────────────
  if (CHOICE_TYPES.includes(q.type) && q.type !== 'YES_NO') {
    if (q.system_list) {
      payload.options = [];
    } else if (q.options.length > 0) {
      payload.options = q.options.map((o, i) => ({
        label: o.label,
        value: o.value || o.label,
        order: i,
      }));
    } else {
      payload.options = [];
    }
  }

  // ── Matrix ──────────────────────────────────────────────────
  if (q.type === 'MATRIX') {
    if (q.matrix_rows.length > 0) {
      payload.matrix_rows = q.matrix_rows.map((r, i) => ({
        label: r.label,
        order: i,
      }));
    }
    if (q.matrix_columns.length > 0) {
      payload.matrix_columns = q.matrix_columns.map((c, i) => ({
        label: c.label,
        value: c.value || c.label,
        order: i,
      }));
    }
  }

  return payload;
}

const isTemp = (id: string) => id.startsWith('temp-');

// ═════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════

export default function BuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === 'new';

  // ── Data state ──────────────────────────────────────────────
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // ── Refs ────────────────────────────────────────────────────
  const loadedIdRef = useRef<string | null>(null);
  const creatingRef = useRef(false);

  // ─────────────────────────────────────────────────────────────
  // Initial load
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Case 1: /builder/new → create a draft & redirect
    if (isNew) {
      if (creatingRef.current) return;
      creatingRef.current = true;
      setLoading(true);

      surveysApi
        .create({
          title: 'پرسشنامه بدون عنوان',
          response_mode: 'IDENTIFIED',
        })
        .then(async (created) => {
          const detail = await surveysApi.detail(created.id);
          loadedIdRef.current = detail.id;
          setSurvey(detail);
          setQuestions([]);
          setSelectedId(null);
          router.replace(`/builder/${detail.id}`, { scroll: false });
        })
        .catch((err) => {
          toast.error(getErrorMessage(err));
          router.replace('/questionnaires');
        })
        .finally(() => {
          setLoading(false);
          creatingRef.current = false;
        });
      return;
    }

    // Case 2: already loaded (avoid re-fetch on state changes)
    if (loadedIdRef.current === params.id) return;

    // Case 3: /builder/{id} → fetch
    setLoading(true);
    surveysApi
      .detail(params.id)
      .then((data) => {
        loadedIdRef.current = data.id;
        setSurvey(data);
        setQuestions(data.questions);
        setSelectedId(data.questions[0]?.id ?? null);
        setDirty(false);
        setDeletedIds(new Set());
      })
      .catch((err) => {
        toast.error(getErrorMessage(err));
        router.replace('/questionnaires');
      })
      .finally(() => setLoading(false));
  }, [params.id, isNew, router]);

  // ─────────────────────────────────────────────────────────────
  // Warn on unsaved changes before closing the tab
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ─────────────────────────────────────────────────────────────
  // Question operations (local — persisted on save())
  // ─────────────────────────────────────────────────────────────

  const selected = questions.find((q) => q.id === selectedId) ?? null;

  const handleAdd = useCallback(
    (type: QuestionType) => {
      if (!survey) {
        toast.error('در حال آماده‌سازی پرسشنامه...');
        return;
      }
      const q = createEmptyQuestion(type, questions.length + 1, survey.id);
      setQuestions((prev) => [...prev, q]);
      setSelectedId(q.id);
      setDirty(true);
    },
    [questions.length, survey],
  );

  const handleUpdate = useCallback((updated: Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setDirty(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (!isTemp(id)) {
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
      setQuestions((prev) => {
        const next = prev.filter((q) => q.id !== id);
        if (selectedId === id) setSelectedId(next[0]?.id ?? null);
        return next;
      });
      setDirty(true);
    },
    [selectedId],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const source = questions.find((q) => q.id === id);
      if (!source || !survey) return;
      const copy: Question = {
        ...source,
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: `${source.title} (کپی)`,
        options: source.options.map((o, i) => ({
          ...o,
          id: `o-${Date.now()}-${i}`,
        })),
        matrix_rows: source.matrix_rows.map((r, i) => ({
          ...r,
          id: `r-${Date.now()}-${i}`,
        })),
        matrix_columns: source.matrix_columns.map((c, i) => ({
          ...c,
          id: `c-${Date.now()}-${i}`,
        })),
      };
      const idx = questions.findIndex((q) => q.id === id);
      const next = [...questions];
      next.splice(idx + 1, 0, copy);
      setQuestions(next);
      setSelectedId(copy.id);
      setDirty(true);
    },
    [questions, survey],
  );

  const handleMove = useCallback((id: string, dir: -1 | 1) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
    setDirty(true);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────
  const save = useCallback(async (): Promise<boolean> => {
    if (!survey) return false;
    setSaving(true);
    try {
      // 1) Persist survey meta
      await surveysApi.update(survey.id, {
        title: survey.title,
        description: survey.description,
        category: survey.category,
        visibility: survey.visibility,
        response_mode: survey.response_mode,
        estimated_time_minutes: survey.estimated_time_minutes,
      });

      // 2) Delete removed questions
      for (const id of deletedIds) {
        try {
          await surveysApi.deleteQuestion(id);
        } catch {
          /* ignore: already gone */
        }
      }

      // 3) Create new + update existing
      const persisted: Question[] = [];
      for (const q of questions) {
        const payload = toQuestionPayload(q, survey.id, false);
        if (isTemp(q.id)) {
          const created = await surveysApi.createQuestion(payload);
          persisted.push(created);
        } else {
          const updated = await surveysApi.updateQuestion(q.id, payload);
          persisted.push(updated);
        }
      }

      // 4) Reorder if needed
      const orderPayload = persisted.map((q, i) => ({ id: q.id, order: i + 1 }));
      const needsReorder = persisted.some((q, i) => q.order !== i + 1);
      if (persisted.length > 0 && needsReorder) {
        try {
          await surveysApi.reorderQuestions(orderPayload);
        } catch (err) {
          console.warn('Reorder failed:', err);
        }
      }

      // 5) Refresh from server
      const fresh = await surveysApi.detail(survey.id);
      setSurvey(fresh);
      setQuestions(fresh.questions);
      setDeletedIds(new Set());
      setDirty(false);
      loadedIdRef.current = fresh.id;

      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [survey, questions, deletedIds]);

  const handleSave = useCallback(async () => {
    const ok = await save();
    if (ok) toast.success('پرسشنامه ذخیره شد');
  }, [save]);

  // ─────────────────────────────────────────────────────────────
  // Publish
  // ─────────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!survey) return;

    const answerable = questions.filter((q) => !NON_ANSWERABLE.includes(q.type));
    if (answerable.length === 0) {
      toast.error('برای انتشار، حداقل یک سوال قابل پاسخ لازم است');
      return;
    }

    setPublishing(true);
    try {
      if (dirty) {
        const ok = await save();
        if (!ok) {
          setPublishing(false);
          return;
        }
      }

      const updated = await surveysApi.publish(survey.id);
      setSurvey(updated);
      toast.success('پرسشنامه با موفقیت منتشر شد 🎉');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }, [survey, questions, dirty, save]);

  // ─────────────────────────────────────────────────────────────
  // Loading / not found
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">
          در حال بارگذاری پرسشنامه...
        </p>
      </div>
    );
  }

  if (!survey) return null;

  const isPublished = survey.status === 'PUBLISHED';
  const canPublish =
    !isPublished &&
    !publishing &&
    questions.some((q) => !NON_ANSWERABLE.includes(q.type));

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-muted/30">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center h-14 px-4 gap-3 bg-card border-b border-border z-20">
        <Link
          href="/questionnaires"
          className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground"
          title="بازگشت"
        >
          <ArrowRight size={16} />
        </Link>

        <div className="w-px h-5 bg-border" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
            <Zap size={12} className="text-primary-foreground" />
          </div>
          <input
            value={survey.title}
            onChange={(e) => {
              setSurvey({ ...survey, title: e.target.value });
              setDirty(true);
            }}
            className="text-sm font-bold bg-transparent border-none outline-none focus:bg-muted focus:px-2 rounded-lg transition-all min-w-[180px] max-w-[300px]"
          />
        </div>

        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
            isPublished
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-amber-500/10 text-amber-600'
          }`}
        >
          {isPublished ? 'منتشرشده' : 'پیش‌نویس'}
        </span>

        {dirty ? (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ذخیره‌نشده
          </span>
        ) : (
          <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
            <Check size={11} className="text-emerald-500" /> ذخیره‌شده
          </span>
        )}

        <div className="flex-1" />

        <Button
          variant="secondary"
          size="sm"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          ذخیره
        </Button>

        <Link href={`/answer/${survey.id}`} target="_blank">
          <Button variant="secondary" size="sm">
            <Eye size={14} /> پیش‌نمایش
          </Button>
        </Link>

        {isPublished ? (
          <Button size="sm" variant="outline" disabled>
            <Check size={14} /> منتشر شده
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={!canPublish || saving || publishing}
            title={
              questions.length === 0
                ? 'ابتدا یک سوال اضافه کنید'
                : !canPublish
                ? 'برای انتشار حداقل یک سوال قابل پاسخ لازم است'
                : ''
            }
          >
            {publishing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            انتشار
          </Button>
        )}
      </div>

      {/* ── Three-column layout ─────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Component library */}
        <div className="w-56 flex-shrink-0 bg-card border-l border-border overflow-hidden hidden lg:block">
          <ComponentLibrary onAdd={handleAdd} />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            {/* Survey header card */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <input
                value={survey.title}
                onChange={(e) => {
                  setSurvey({ ...survey, title: e.target.value });
                  setDirty(true);
                }}
                placeholder="عنوان پرسشنامه..."
                className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              />
              <textarea
                value={survey.description}
                onChange={(e) => {
                  setSurvey({ ...survey, description: e.target.value });
                  setDirty(true);
                }}
                rows={2}
                placeholder="توضیحات (اختیاری)..."
                className="w-full mt-2 text-sm text-muted-foreground bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Questions */}
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-2xl">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                  <Plus size={24} className="text-muted-foreground" />
                </div>
                <h3 className="text-sm font-bold mb-1">
                  شروع ساخت پرسشنامه
                </h3>
                <p className="text-xs text-muted-foreground max-w-xs mb-4">
                  از پنل سمت راست یک سوال انتخاب کنید یا اولین سوال خود را
                  اضافه کنید.
                </p>
                <Button onClick={() => handleAdd('SHORT_TEXT')}>
                  افزودن اولین سوال
                </Button>
              </div>
            ) : (
              <>
                {questions.map((q, i) => {
                  const isContent = NON_ANSWERABLE.includes(q.type);
                  const answerableIdx =
                    questions
                      .slice(0, i + 1)
                      .filter((qq) => !NON_ANSWERABLE.includes(qq.type)).length -
                    1;

                  return (
                    <div key={q.id} className="relative group/wrap">
                      <QuestionCard
                        question={q}
                        index={isContent ? -1 : answerableIdx}
                        selected={q.id === selectedId}
                        onSelect={() => setSelectedId(q.id)}
                        onDelete={() => handleDelete(q.id)}
                        onDuplicate={() => handleDuplicate(q.id)}
                        onChange={handleUpdate}
                      />

                      {/* Move up/down buttons (hover) */}
                      <div className="absolute -left-10 top-3 flex flex-col gap-1 opacity-0 group-hover/wrap:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMove(q.id, -1)}
                          disabled={i === 0}
                          className="w-7 h-7 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs"
                          title="بالا"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMove(q.id, 1)}
                          disabled={i === questions.length - 1}
                          className="w-7 h-7 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs"
                          title="پایین"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={() => handleAdd('SHORT_TEXT')}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-2xl text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
                >
                  <Plus size={16} /> افزودن سوال
                </button>
              </>
            )}

            {/* Summary footer */}
            {questions.length > 0 && (
              <div className="text-xs text-muted-foreground text-center pt-4">
                {toFa(
                  questions.filter((q) => !NON_ANSWERABLE.includes(q.type))
                    .length,
                )}{' '}
                سوال قابل پاسخ · {toFa(questions.length)} سوال در کل
              </div>
            )}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-72 flex-shrink-0 bg-card border-r border-border overflow-hidden hidden xl:block">
          <PropertiesPanel question={selected} onChange={handleUpdate} />
        </div>
      </div>
    </div>
  );
}