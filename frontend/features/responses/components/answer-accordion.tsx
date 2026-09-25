'use client';

import { useState } from 'react';
import { ChevronDown, FileText, Download } from 'lucide-react';
import type { Question } from '@/features/surveys/types';
import type { AnswerRecord } from '@/features/responses/types';
import { cn, toFa } from '@/shared/lib/utils';

interface Props {
  questions: Question[];
  answers: Record<string, AnswerRecord>;
}

export function AnswerAccordion({ questions, answers }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    new Set(questions.slice(0, 3).map((q) => q.id)),
  );

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const answerableQuestions = questions.filter(
    (q) => !['TEXT_BLOCK', 'SECTION'].includes(q.type),
  );

  if (answerableQuestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        این پرسشنامه سوال قابل پاسخی ندارد.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {answerableQuestions.map((q, i) => {
        const answer = answers[q.id];
        const isOpen = openIds.has(q.id);

        return (
          <div
            key={q.id}
            className={cn(
              'bg-card rounded-2xl border transition-all',
              isOpen ? 'border-primary/30 shadow-sm' : 'border-border',
            )}
          >
            <button
              onClick={() => toggle(q.id)}
              className="w-full flex items-start gap-4 px-5 py-4 text-right hover:bg-accent/30 transition-colors rounded-2xl"
            >
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5">
                سوال {toFa(i + 1)}
              </span>
              <span className="flex-1 text-sm font-medium leading-snug">
                {q.title}
              </span>
              <ChevronDown
                size={16}
                className={cn(
                  'text-muted-foreground flex-shrink-0 mt-0.5 transition-transform',
                  isOpen && 'rotate-180',
                )}
              />
            </button>

            {isOpen && (
              <div className="px-5 pb-4 pt-1 border-t border-border">
                <div className="pt-3">
                  <AnswerDisplay question={q} answer={answer} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Value renderer per question type
// ─────────────────────────────────────────────────────────────

function AnswerDisplay({
  question,
  answer,
}: {
  question: Question;
  answer: AnswerRecord | undefined;
}) {
  if (!answer) {
    return (
      <p className="text-sm text-muted-foreground italic">
        به این سوال پاسخی داده نشده است.
      </p>
    );
  }

  const value = answer.value ?? {};
  const t = question.type;

  // File upload
  if (t === 'FILE_UPLOAD') {
    const files = answer.files ?? [];
    if (files.length === 0) {
      return (
        <p className="text-sm text-muted-foreground italic">فایلی بارگذاری نشده است.</p>
      );
    }
    return (
      <div className="space-y-2">
        {files.map((f) => (
          <a
            key={f.id}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary">
                {f.original_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(f.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Download
              size={14}
              className="text-muted-foreground group-hover:text-primary flex-shrink-0"
            />
          </a>
        ))}
      </div>
    );
  }

  // Text (short/long)
  if (t === 'SHORT_TEXT' || t === 'LONG_TEXT') {
    const text = value.text as string | undefined;
    if (!text) return <Empty />;
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
    );
  }

  // Multiple choice / Ranking
  if (t === 'MULTIPLE_CHOICE' || t === 'RANKING') {
    const values = (value.values as string[]) ?? [];
    if (values.length === 0) return <Empty />;
    const labels = values.map((v) => {
      const opt = question.options.find((o) => o.value === v);
      return opt?.label ?? v;
    });
    return (
      <div className="flex flex-wrap gap-2">
        {labels.map((label, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {label}
          </span>
        ))}
      </div>
    );
  }

  // Matrix
  if (t === 'MATRIX') {
    const cells = value.value as Record<string, string> | undefined;
    if (!cells || Object.keys(cells).length === 0) return <Empty />;
    return (
      <div className="space-y-2">
        {Object.entries(cells).map(([rowId, colValue]) => {
          const row = question.matrix_rows.find((r) => r.id === rowId);
          const col = question.matrix_columns.find((c) => c.value === colValue);
          return (
            <div
              key={rowId}
              className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-muted/50 text-sm"
            >
              <span className="text-muted-foreground">{row?.label ?? rowId}</span>
              <span className="font-medium">{col?.label ?? colValue}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Single value (choice/number/date/yes-no)
  const v = value.value;
  if (v === null || v === undefined || v === '') return <Empty />;

  // Try to find option label
  if (typeof v === 'string') {
    const opt = question.options.find((o) => o.value === v);
    if (opt) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          {opt.label}
        </span>
      );
    }
    return <p className="text-sm">{v}</p>;
  }

  return <p className="text-sm">{String(v)}</p>;
}

function Empty() {
  return (
    <p className="text-sm text-muted-foreground italic">
      پاسخی داده نشده است.
    </p>
  );
}