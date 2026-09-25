'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Copy, GripVertical, Trash2, AlignLeft, Type, Info,
} from 'lucide-react';
import type { Question } from '@/features/surveys/types';
import { QuestionPreview } from './question-preview';
import { questionTypeLabels, NON_ANSWERABLE } from '../question-types';
import { cn, toFa } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Auto-growing textarea
// ═════════════════════════════════════════════════════════════════

interface AutoGrowProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  maxRows?: number;
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  className,
  onClick,
  maxRows = 10,
}: AutoGrowProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Adjust height to fit content
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 22;
    const maxHeight = lineHeight * maxRows;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [value, maxRows]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={handleChange}
      onClick={onClick}
      onKeyDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      rows={1}
      className={cn(
        'w-full bg-transparent border-none outline-none resize-none',
        'placeholder:text-muted-foreground/40',
        'focus:bg-muted/40 focus:rounded-lg focus:px-2 focus:py-1',
        'transition-all leading-relaxed',
        className,
      )}
    />
  );
}

// ═════════════════════════════════════════════════════════════════
// Question Card
// ═════════════════════════════════════════════════════════════════

interface Props {
  question: Question;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onChange?: (updated: Question) => void;
}

export function QuestionCard({
  question,
  index,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onChange,
}: Props) {
  const isTextBlock = question.type === 'TEXT_BLOCK';
  const isSection = question.type === 'SECTION';
  const isContent = isTextBlock || isSection;

  // Stop event propagation so clicks inside inputs don't bubble to onSelect
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // ── Update handlers ─────────────────────────────────────────
  const updateTitle = (v: string) => {
    if (!onChange) return;
    onChange({
      ...question,
      title: v,
      // For content types, mirror into settings.text so answer page/PDF find it
      ...(isContent ? { settings: { ...question.settings, text: v } } : {}),
    });
  };

  const updateDescription = (v: string) => {
    if (!onChange) return;
    onChange({ ...question, description: v });
  };

  // ── Text content of content types ──────────────────────────
  const contentText =
    (question.settings?.text as string) || question.title || '';

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative bg-card rounded-2xl border transition-all',
        selected
          ? 'border-primary/50 shadow-md shadow-primary/10 ring-2 ring-primary/10'
          : 'border-border hover:border-border/80 hover:shadow-sm',
      )}
    >
      {/* Drag handle */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 cursor-grab">
        <GripVertical size={16} />
      </div>

      {/* Body */}
      <div className="p-5 pr-10">
        {/* ═══════════════ TEXT_BLOCK ═══════════════ */}
        {isTextBlock && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <AlignLeft size={12} className="text-primary" />
              </div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                بلوک متن
              </span>
              <Info size={11} className="text-muted-foreground ml-1" />
              <span className="text-[10px] text-muted-foreground">
                محتوای نمایشی — بدون پاسخ
              </span>
            </div>

            <AutoGrowTextarea
              value={contentText}
              onChange={updateTitle}
              onClick={stop}
              placeholder="متن توضیحی خود را اینجا بنویسید..."
              className="text-sm text-foreground"
              maxRows={12}
            />

            <p className="text-[10px] text-muted-foreground">
              {toFa(contentText.length)} کاراکتر
            </p>
          </div>
        )}

        {/* ═══════════════ SECTION ═══════════════ */}
        {isSection && (
          <div className="space-y-3 border-r-4 border-primary/50 pr-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <Type size={12} className="text-primary" />
              </div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                بخش
              </span>
              <Info size={11} className="text-muted-foreground ml-1" />
              <span className="text-[10px] text-muted-foreground">
                عنوان گروه‌بندی سوالات
              </span>
            </div>

            <AutoGrowTextarea
              value={contentText}
              onChange={updateTitle}
              onClick={stop}
              placeholder="عنوان بخش (مثلاً: اطلاعات شخصی)"
              className="text-lg font-bold text-foreground"
              maxRows={3}
            />

            <AutoGrowTextarea
              value={question.description}
              onChange={updateDescription}
              onClick={stop}
              placeholder="توضیحات بخش (اختیاری)..."
              className="text-xs text-muted-foreground"
              maxRows={5}
            />
          </div>
        )}

        {/* ═══════════════ REGULAR ANSWERABLE ═══════════════ */}
        {!isContent && (
          <>
            {/* Header row */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                سوال {toFa(index + 1)}
              </span>
              <span className="text-xs text-muted-foreground">
                {questionTypeLabels[question.type]}
              </span>
              {question.required && (
                <span className="text-xs text-destructive font-medium">
                  اجباری
                </span>
              )}
            </div>

            {/* Editable title */}
            <AutoGrowTextarea
              value={question.title}
              onChange={updateTitle}
              onClick={stop}
              placeholder="متن سوال را اینجا بنویسید..."
              className="text-sm font-bold text-foreground"
              maxRows={4}
            />

            {/* Editable description */}
            <div className="mt-1">
              <AutoGrowTextarea
                value={question.description}
                onChange={updateDescription}
                onClick={stop}
                placeholder="توضیحات (اختیاری)..."
                className="text-xs text-muted-foreground"
                maxRows={5}
              />
            </div>

            {/* Preview */}
            <div className="mt-4 pt-4 border-t border-border/60">
              <QuestionPreview question={question} />
            </div>
          </>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 px-5 py-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="flex-1 text-xs text-muted-foreground">
          {selected ? 'انتخاب شده' : 'برای ویرایش کلیک کنید'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors"
          title="کپی"
        >
          <Copy size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
          title="حذف"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}