'use client';

import { useState } from 'react';
import {
  Star, Loader2, AlignLeft, Type, Upload, Info, Hash, Mail, Phone,
  Globe, AlignJustify, Calendar, Clock, MessageSquare,
} from 'lucide-react';

import type { Question } from '@/features/surveys/types';
import type { AnswerFile } from '@/features/responses/types';
import { useSystemList } from '@/features/system-lists/hooks';
import { itemsToOptions } from '@/features/system-lists/utils';
import { FileUpload } from './file-upload';
import { toFa, cn } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════

export type AnswerValue =
  | string
  | string[]
  | number
  | Record<string, string>
  | AnswerFile[]
  | null;

interface Props {
  question: Question;
  surveyId: string;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}

const CHOICE_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN', 'LIKERT', 'RANKING'];

// ═════════════════════════════════════════════════════════════════
// Main renderer
// ═════════════════════════════════════════════════════════════════

export function QuestionRenderer({ question, surveyId, value, onChange }: Props) {
  const { type, settings, options, system_list } = question;

  const { systemList, loading: listLoading } = useSystemList(system_list);

  const hasList = !!system_list;
  const listOptions = hasList && systemList ? itemsToOptions(systemList.items) : [];
  const effectiveOptions = hasList ? listOptions : options;

  // ─── TEXT_BLOCK ─────────────────────────────────────────────
  if (type === 'TEXT_BLOCK') {
    const text = (settings.text as string) || question.title || '';
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-5 max-w-lg">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <AlignLeft size={14} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5">
              بلوک متن
            </p>
            {text.trim() ? (
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
                {text}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                متنی وارد نشده است
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── SECTION ────────────────────────────────────────────────
  if (type === 'SECTION') {
    const title = (settings.text as string) || question.title || '';
    return (
      <div className="space-y-2 border-r-4 border-primary/60 pr-5 py-2 max-w-lg">
        <div className="flex items-center gap-2">
          <Type size={14} className="text-primary" />
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
            بخش
          </span>
        </div>
        {title.trim() ? (
          <h3 className="text-xl font-bold text-foreground leading-snug">
            {title}
          </h3>
        ) : (
          <h3 className="text-lg font-bold text-muted-foreground italic">
            عنوان بخش وارد نشده
          </h3>
        )}
        {question.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {question.description}
          </p>
        )}
      </div>
    );
  }

  // ─── FILE_UPLOAD ────────────────────────────────────────────
  if (type === 'FILE_UPLOAD') {
    return (
      <FileUpload
        surveyId={surveyId}
        value={(value as AnswerFile[]) ?? []}
        onChange={(next) => onChange(next as unknown as AnswerValue)}
      />
    );
  }

  // ─── Simple text ────────────────────────────────────────────
  if (type === 'SHORT_TEXT') {
    return (
      <input
        type="text"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={(settings.placeholder as string) || 'پاسخ خود را اینجا بنویسید...'}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all placeholder:text-muted-foreground/40"
        autoFocus
      />
    );
  }

  if (type === 'LONG_TEXT') {
    return (
      <textarea
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder={(settings.placeholder as string) || 'نظر خود را بنویسید...'}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all resize-none placeholder:text-muted-foreground/40"
        autoFocus
      />
    );
  }

  if (type === 'EMAIL') {
    return (
      <input
        type="email"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={(settings.placeholder as string) || 'you@example.com'}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all placeholder:text-muted-foreground/40"
        autoFocus
      />
    );
  }

  if (type === 'PHONE') {
    return (
      <input
        type="tel"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={(settings.placeholder as string) || '+98 912 345 6789'}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all placeholder:text-muted-foreground/40"
        autoFocus
      />
    );
  }

  if (type === 'URL') {
    return (
      <input
        type="url"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={(settings.placeholder as string) || 'https://example.com'}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all placeholder:text-muted-foreground/40"
        autoFocus
      />
    );
  }

  if (type === 'NUMBER') {
    return (
      <input
        type="number"
        value={(value as number) ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        min={settings.min as number | undefined}
        max={settings.max as number | undefined}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all"
        autoFocus
      />
    );
  }

  // ─── Date / Time ────────────────────────────────────────────
  if (type === 'DATE') {
    return (
      <input
        type="date"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all"
        autoFocus
      />
    );
  }

  if (type === 'TIME') {
    return (
      <input
        type="time"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all"
        autoFocus
      />
    );
  }

  if (type === 'DATETIME') {
    return (
      <input
        type="datetime-local"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all"
        autoFocus
      />
    );
  }

  // ─── YES_NO ─────────────────────────────────────────────────
  if (type === 'YES_NO') {
    return <YesNoInput value={(value as string) ?? ''} onChange={onChange} />;
  }

  // ─── Choice types ───────────────────────────────────────────
  if (type === 'SINGLE_CHOICE' || type === 'DROPDOWN' || type === 'LIKERT') {
    if (hasList && listLoading) return <ListLoading />;
    if (hasList && effectiveOptions.length === 0) return <EmptyList />;
    return (
      <SingleChoiceInput
        options={effectiveOptions}
        value={(value as string) ?? ''}
        onChange={onChange}
      />
    );
  }

  if (type === 'MULTIPLE_CHOICE' || type === 'RANKING') {
    if (hasList && listLoading) return <ListLoading />;
    if (hasList && effectiveOptions.length === 0) return <EmptyList />;
    return (
      <MultipleChoiceInput
        options={effectiveOptions}
        value={(value as string[]) ?? []}
        onChange={onChange}
      />
    );
  }

  // ─── Rating ─────────────────────────────────────────────────
  if (type === 'RATING') {
    const max = (settings.max as number) || 5;
    return (
      <RatingInput value={(value as number) ?? 0} onChange={onChange} max={max} />
    );
  }

  // ─── NPS ────────────────────────────────────────────────────
  if (type === 'NPS') {
    return (
      <NpsInput
        value={value === null ? null : (value as number)}
        onChange={onChange}
      />
    );
  }

  // ─── Linear scale / Slider ──────────────────────────────────
  if (type === 'LINEAR_SCALE' || type === 'SLIDER') {
    const min = (settings.min as number) ?? 0;
    const max = (settings.max as number) ?? 10;
    return (
      <LinearScaleInput
        min={min}
        max={max}
        value={value === null ? null : (value as number)}
        onChange={onChange}
      />
    );
  }

  // ─── Matrix ─────────────────────────────────────────────────
  if (type === 'MATRIX') {
    return <MatrixInput question={question} value={value} onChange={onChange} />;
  }

  // ─── Fallback ───────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2 bg-muted/30 border border-dashed border-border rounded-lg px-4 py-3 text-sm text-muted-foreground max-w-lg">
      <Info size={14} />
      این نوع سوال ({type}) در حال حاضر پشتیبانی نمی‌شود
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Validation
// ═════════════════════════════════════════════════════════════════

export function isAnswerValid(question: Question, value: AnswerValue): boolean {
  // Content types are always valid
  if (question.type === 'TEXT_BLOCK' || question.type === 'SECTION') return true;

  if (!question.required) return true;
  if (value === null || value === undefined) return false;

  if (question.type === 'FILE_UPLOAD') {
    const arr = (value as AnswerFile[]) ?? [];
    return arr.length > 0;
  }

  if (typeof value === 'string' && value.trim() === '') return false;
  if (typeof value === 'number' && Number.isNaN(value)) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  ) {
    return false;
  }
  return true;
}

// ═════════════════════════════════════════════════════════════════
// Inputs
// ═════════════════════════════════════════════════════════════════

interface OptionShape { id: string; label: string; value: string; }

function SingleChoiceInput({
  options, value, onChange,
}: {
  options: OptionShape[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3 max-w-lg">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-right transition-all',
              selected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/30',
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                selected ? 'border-primary bg-primary' : 'border-border',
              )}
            >
              {selected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
            </div>
            <span className="text-base font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultipleChoiceInput({
  options, value, onChange,
}: {
  options: OptionShape[]; value: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="space-y-3 max-w-lg">
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-right transition-all',
              selected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/30',
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all',
                selected ? 'border-primary bg-primary' : 'border-border',
              )}
            >
              {selected && (
                <svg
                  viewBox="0 0 12 12"
                  className="w-3 h-3 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2,6 5,9 10,3" />
                </svg>
              )}
            </div>
            <span className="text-base font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function YesNoInput({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-4 flex-wrap">
      {[
        { v: 'yes', label: 'بله' },
        { v: 'no', label: 'خیر' },
      ].map((opt) => (
        <button
          key={opt.v}
          type="button"
          onClick={() => onChange(opt.v)}
          className={cn(
            'px-10 py-4 rounded-2xl text-base font-semibold border-2 transition-all',
            value === opt.v
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border bg-card text-muted-foreground hover:border-primary/30',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RatingInput({
  value, onChange, max,
}: {
  value: number; onChange: (v: number) => void; max: number;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max }).map((_, i) => {
          const n = i + 1;
          const filled = n <= (hover || value);
          return (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => onChange(n)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                size={40}
                className={cn(
                  'transition-all',
                  filled ? 'fill-amber-400 text-amber-400' : 'text-border fill-muted',
                )}
              />
            </button>
          );
        })}
      </div>
      {value > 0 && (
        <p className="text-sm text-muted-foreground">
          امتیاز شما:{' '}
          <span className="font-bold text-foreground">{toFa(value)}</span> از{' '}
          {toFa(max)}
        </p>
      )}
    </div>
  );
}

function NpsInput({
  value, onChange,
}: {
  value: number | null; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 11 }).map((_, i) => {
          const selected = value === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={cn(
                'w-12 h-12 rounded-xl font-semibold text-sm transition-all',
                selected
                  ? 'bg-primary text-primary-foreground shadow-md scale-105'
                  : 'bg-card border-2 border-border text-muted-foreground hover:border-primary/40 hover:text-primary',
              )}
            >
              {toFa(i)}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-3 max-w-md">
        <span className="text-xs text-muted-foreground">اصلاً احتمال ندارد</span>
        <span className="text-xs text-muted-foreground">قطعاً توصیه می‌کنم</span>
      </div>
      {value !== null && (
        <p className="mt-3 text-sm text-muted-foreground">
          امتیاز شما:{' '}
          <span className="font-bold text-foreground">{toFa(value)}</span>
        </p>
      )}
    </div>
  );
}

function LinearScaleInput({
  min, max, value, onChange,
}: {
  min: number; max: number; value: number | null; onChange: (v: number) => void;
}) {
  const count = max - min + 1;

  if (count > 20) {
    return (
      <div className="max-w-lg space-y-3">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value ?? min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{toFa(min)}</span>
          <span className="font-bold text-foreground text-base">
            {toFa(value ?? min)}
          </span>
          <span>{toFa(max)}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: count }).map((_, i) => {
          const n = min + i;
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                'w-12 h-12 rounded-xl font-semibold text-sm transition-all',
                selected
                  ? 'bg-primary text-primary-foreground shadow-md scale-105'
                  : 'bg-card border-2 border-border text-muted-foreground hover:border-primary/40 hover:text-primary',
              )}
            >
              {toFa(n)}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-3 max-w-md">
        <span className="text-xs text-muted-foreground">{toFa(min)}</span>
        <span className="text-xs text-muted-foreground">{toFa(max)}</span>
      </div>
      {value !== null && (
        <p className="mt-3 text-sm text-muted-foreground">
          انتخاب شما:{' '}
          <span className="font-bold text-foreground">{toFa(value)}</span>
        </p>
      )}
    </div>
  );
}

function MatrixInput({
  question, value, onChange,
}: {
  question: Question; value: AnswerValue; onChange: (v: AnswerValue) => void;
}) {
  const cells = (
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  ) as Record<string, string>;

  const rows = [...(question.matrix_rows ?? [])].sort((a, b) => a.order - b.order);
  const cols = [...(question.matrix_columns ?? [])].sort((a, b) => a.order - b.order);

  if (rows.length === 0 || cols.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        این ماتریس هنوز ردیف یا ستونی ندارد.
      </p>
    );
  }

  const pick = (rowId: string, colValue: string) => {
    onChange({ ...cells, [rowId]: colValue });
  };

  return (
    <div className="overflow-x-auto max-w-2xl rounded-2xl border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-right p-3 min-w-[140px]"></th>
            {cols.map((c) => (
              <th
                key={c.id}
                className="text-center p-3 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[80px]"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.id} className={ri % 2 === 0 ? 'bg-muted/20' : ''}>
              <td className="text-right p-3 font-medium whitespace-nowrap">
                {r.label}
              </td>
              {cols.map((c) => {
                const selected = cells[r.id] === c.value;
                return (
                  <td key={c.id} className="text-center p-2">
                    <button
                      type="button"
                      onClick={() => pick(r.id, c.value)}
                      className={cn(
                        'w-9 h-9 rounded-full border-2 inline-flex items-center justify-center transition-all',
                        selected
                          ? 'border-primary bg-primary scale-105'
                          : 'border-border hover:border-primary/40',
                      )}
                      aria-label={`${r.label} - ${c.label}`}
                    >
                      {selected && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListLoading() {
  return (
    <div className="max-w-lg space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-border bg-muted/30 animate-pulse"
        >
          <div className="w-5 h-5 rounded-full bg-muted" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      ))}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" /> در حال بارگذاری گزینه‌ها...
      </div>
    </div>
  );
}

function EmptyList() {
  return (
    <p className="text-sm text-muted-foreground">
      لیست انتخابی خالی است. لطفاً با مدیر سیستم تماس بگیرید.
    </p>
  );
}