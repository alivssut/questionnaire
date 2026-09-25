'use client';

import {
  X, Plus, List, Sparkles, Loader2, ListChecks,
  AlignLeft, Type, Info, Grid3X3, Upload, Star, Hash,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Question } from '@/features/surveys/types';
import {
  questionTypeLabels,
  NON_ANSWERABLE,
  CHOICE_TYPES,
  NUMERIC_TYPES,
} from '../question-types';
import { Switch } from '@/shared/components/ui/switch';
import { SystemListSelect } from './system-list-select';
import { useSystemList } from '@/features/system-lists/hooks';
import { toFa, cn } from '@/shared/lib/utils';

const DEFAULT_OPTIONS = [
  { id: 'o1', label: 'گزینه ۱', value: 'option_1', order: 0 },
  { id: 'o2', label: 'گزینه ۲', value: 'option_2', order: 1 },
];

export function PropertiesPanel({
  question,
  onChange,
}: {
  question: Question | null;
  onChange: (q: Question) => void;
}) {
  const { systemList, loading: listLoading } = useSystemList(
    question?.system_list ?? null,
  );

  if (!question) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mb-3">
          <List size={20} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">سوالی انتخاب نشده</p>
        <p className="text-xs text-muted-foreground">
          برای ویرایش، روی یک سوال کلیک کنید
        </p>
      </div>
    );
  }

  const isTextBlock = question.type === 'TEXT_BLOCK';
  const isSection = question.type === 'SECTION';
  const isContent = isTextBlock || isSection;
  const isChoice = CHOICE_TYPES.includes(question.type);
  const isNumeric = NUMERIC_TYPES.includes(question.type);
  const isMatrix = question.type === 'MATRIX';
  const isFileUpload = question.type === 'FILE_UPLOAD';
  const usesList = !!question.system_list;
  const update = (patch: Partial<Question>) => onChange({ ...question, ...patch });

  const handleSystemListChange = (id: string | null) => {
    if (id) {
      update({ system_list: id, options: [] });
    } else {
      update({
        system_list: null,
        options: question.options.length > 0 ? question.options : DEFAULT_OPTIONS,
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2">
          {isTextBlock && <AlignLeft size={12} className="text-primary" />}
          {isSection && <Type size={12} className="text-primary" />}
          {isMatrix && <Grid3X3 size={12} className="text-primary" />}
          {isFileUpload && <Upload size={12} className="text-primary" />}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {questionTypeLabels[question.type]}
          </p>
        </div>
        <p className="text-sm font-bold mt-0.5">تنظیمات</p>
      </div>

      <div className="p-5 space-y-5">
        {/* ═══════════════════════════════════════════════════ */}
        {/* CONTENT — TEXT_BLOCK / SECTION                      */}
        {/* ═══════════════════════════════════════════════════ */}
        {isContent && (
          <>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Info size={14} className="text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed flex-1">
                <p className="font-semibold text-primary mb-1">
                  {isTextBlock ? 'بلوک متن' : 'بخش'}
                </p>
                <p className="text-muted-foreground">
                  {isTextBlock
                    ? 'متن را مستقیماً روی کارت وسط ویرایش کنید.'
                    : 'عنوان و توضیحات را مستقیماً روی کارت وسط ویرایش کنید.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2">
                پیش‌نمایش
              </label>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {(question.settings?.text as string) ||
                    question.title || (
                      <span className="text-muted-foreground italic text-xs">
                        هنوز متنی وارد نشده
                      </span>
                    )}
                </p>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ANSWERABLE — Title + Description                    */}
        {/* ═══════════════════════════════════════════════════ */}
        {!isContent && (
          <>
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                عنوان سوال
              </label>
              <textarea
                value={question.title}
                onChange={(e) => update({ title: e.target.value })}
                rows={2}
                placeholder="متن سوال را وارد کنید..."
                className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                توضیحات
              </label>
              <textarea
                value={question.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={2}
                placeholder="توضیح اختیاری..."
                className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* CHOICE — options editor                             */}
        {/* ═══════════════════════════════════════════════════ */}
        {isChoice && (
          <>
            <SystemListSelect
              value={question.system_list}
              onChange={handleSystemListChange}
            />

            {usesList ? (
              <SystemListPreview
                loading={listLoading}
                name={systemList?.name ?? ''}
                items={systemList?.items ?? []}
              />
            ) : (
              <div>
                <label className="block text-xs font-semibold mb-2">
                  گزینه‌ها
                </label>
                <div className="space-y-1.5">
                  {question.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 text-center">
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => {
                          const next = [...question.options];
                          next[i] = {
                            ...opt,
                            label: e.target.value,
                            value: e.target.value,
                          };
                          update({ options: next });
                        }}
                        className="flex-1 h-8 px-2.5 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        onClick={() =>
                          update({
                            options: question.options.filter((o) => o.id !== opt.id),
                          })
                        }
                        disabled={question.options.length <= 2}
                        className="text-muted-foreground hover:text-destructive p-1 disabled:opacity-30"
                        title="حذف"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      update({
                        options: [
                          ...question.options,
                          {
                            id: `o${Date.now()}`,
                            label: `گزینه ${question.options.length + 1}`,
                            value: `option_${question.options.length + 1}`,
                            order: question.options.length,
                          },
                        ],
                      })
                    }
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-1"
                  >
                    <Plus size={12} /> افزودن گزینه
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* RATING — scale                                      */}
        {/* ═══════════════════════════════════════════════════ */}
        {question.type === 'RATING' && (
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              مقیاس ستاره‌ای
            </label>
            <div className="flex gap-2">
              {[3, 5, 7, 10].map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    update({ settings: { ...question.settings, max: n } })
                  }
                  className={cn(
                    'flex-1 py-2 text-sm font-medium rounded-xl border transition-all',
                    ((question.settings.max as number) || 5) === n
                      ? 'border-primary/50 bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-border/80',
                  )}
                >
                  {toFa(n)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* NUMERIC — min/max                                   */}
        {/* ═══════════════════════════════════════════════════ */}
        {(question.type === 'NUMBER' ||
          question.type === 'LINEAR_SCALE' ||
          question.type === 'SLIDER' ||
          question.type === 'NPS') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                حداقل
              </label>
              <input
                type="number"
                value={(question.settings.min as number) ?? (question.type === 'NPS' ? 0 : 0)}
                onChange={(e) =>
                  update({
                    settings: { ...question.settings, min: Number(e.target.value) },
                  })
                }
                disabled={question.type === 'NPS'}
                className="w-full h-9 px-3 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                حداکثر
              </label>
              <input
                type="number"
                value={
                  (question.settings.max as number) ??
                  (question.type === 'NPS' ? 10 : 10)
                }
                onChange={(e) =>
                  update({
                    settings: { ...question.settings, max: Number(e.target.value) },
                  })
                }
                disabled={question.type === 'NPS'}
                className="w-full h-9 px-3 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* MATRIX — rows + columns editors                     */}
        {/* ═══════════════════════════════════════════════════ */}
        {isMatrix && <MatrixEditor question={question} update={update} />}

        {/* ═══════════════════════════════════════════════════ */}
        {/* FILE_UPLOAD — info only                             */}
        {/* ═══════════════════════════════════════════════════ */}
        {isFileUpload && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <Info size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed flex-1">
              <p className="font-semibold text-primary mb-1">بارگذاری فایل</p>
              <p className="text-muted-foreground">
                پاسخ‌دهنده می‌تواند تا ۵ فایل (هر کدام حداکثر ۱۰ مگابایت)
                بارگذاری کند. فرمت‌های مجاز: JPG، PNG، WebP، PDF، TXT، DOC، DOCX.
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* Required toggle                                     */}
        {/* ═══════════════════════════════════════════════════ */}
        {!isContent && (
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div>
              <p className="text-xs font-semibold">اجباری</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                پاسخ‌دهنده باید پر کند
              </p>
            </div>
            <Switch
              checked={question.required}
              onCheckedChange={(v) => update({ required: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Matrix Editor — rows + columns
// ═════════════════════════════════════════════════════════════════

function MatrixEditor({
  question,
  update,
}: {
  question: Question;
  update: (patch: Partial<Question>) => void;
}) {
  const rows = question.matrix_rows ?? [];
  const cols = question.matrix_columns ?? [];

  // ── Rows handlers ─────────────────────────────────────────
  const addRow = () =>
    update({
      matrix_rows: [
        ...rows,
        {
          id: `r${Date.now()}`,
          label: `ردیف ${rows.length + 1}`,
          order: rows.length,
        },
      ],
    });

  const updateRow = (id: string, label: string) =>
    update({
      matrix_rows: rows.map((r) => (r.id === id ? { ...r, label } : r)),
    });

  const removeRow = (id: string) =>
    update({ matrix_rows: rows.filter((r) => r.id !== id) });

  // ── Columns handlers ──────────────────────────────────────
  const addColumn = () =>
    update({
      matrix_columns: [
        ...cols,
        {
          id: `c${Date.now()}`,
          label: `ستون ${cols.length + 1}`,
          value: `col_${cols.length + 1}`,
          order: cols.length,
        },
      ],
    });

  const updateColumn = (id: string, patch: { label?: string; value?: string }) =>
    update({
      matrix_columns: cols.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  const removeColumn = (id: string) =>
    update({ matrix_columns: cols.filter((c) => c.id !== id) });

  return (
    <>
      {/* Warning */}
      {(rows.length === 0 || cols.length === 0) && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          ماتریس باید حداقل یک ردیف و یک ستون داشته باشد.
        </div>
      )}

      {/* Rows */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold flex items-center gap-1.5">
            <List size={11} /> ردیف‌ها
          </label>
          <span className="text-[10px] text-muted-foreground">
            {toFa(rows.length)} ردیف
          </span>
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4 text-center">
                {i + 1}
              </span>
              <input
                type="text"
                value={r.label}
                onChange={(e) => updateRow(r.id, e.target.value)}
                placeholder={`ردیف ${i + 1}`}
                className="flex-1 h-8 px-2.5 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => removeRow(r.id)}
                disabled={rows.length <= 1}
                className="text-muted-foreground hover:text-destructive p-1 disabled:opacity-30"
                title="حذف"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-1"
          >
            <Plus size={12} /> افزودن ردیف
          </button>
        </div>
      </div>

      {/* Columns */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold flex items-center gap-1.5">
            <List size={11} /> ستون‌ها
          </label>
          <span className="text-[10px] text-muted-foreground">
            {toFa(cols.length)} ستون
          </span>
        </div>
        <div className="space-y-1.5">
          {cols.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4 text-center">
                {i + 1}
              </span>
              <input
                type="text"
                value={c.label}
                onChange={(e) => updateColumn(c.id, { label: e.target.value })}
                placeholder={`ستون ${i + 1}`}
                className="flex-1 h-8 px-2.5 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => removeColumn(c.id)}
                disabled={cols.length <= 1}
                className="text-muted-foreground hover:text-destructive p-1 disabled:opacity-30"
                title="حذف"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={addColumn}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-1"
          >
            <Plus size={12} /> افزودن ستون
          </button>
        </div>
      </div>

      {/* Preview summary */}
      {rows.length > 0 && cols.length > 0 && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-[10px] text-muted-foreground">
            ماتریس با {toFa(rows.length)} ردیف و {toFa(cols.length)} ستون —
            مجموع {toFa(rows.length * cols.length)} خانه
          </p>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// System List Preview
// ═════════════════════════════════════════════════════════════════

function SystemListPreview({
  loading,
  name,
  items,
}: {
  loading: boolean;
  name: string;
  items: { id: string; label: string; value: string; order: number }[];
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-start gap-2.5 p-3 border-b border-primary/10">
        <Sparkles size={14} className="text-primary flex-shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed flex-1">
          <p className="font-semibold text-primary">از لیست آماده استفاده می‌شود</p>
          <p className="text-muted-foreground mt-0.5">
            گزینه‌ها از لیست {name ? `«${name}»` : ''} خوانده می‌شوند.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> در حال بارگذاری...
        </div>
      ) : items.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground">این لیست خالی است.</div>
      ) : (
        <>
          <div className="px-3 py-2 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-primary/5">
            <ListChecks size={11} />
            {toFa(items.length)} آیتم
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-border/50">
            {items
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 px-3 py-2 text-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                  <span className="truncate flex-1">{it.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">
                    {it.value}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}