'use client';

import {
  Star, Loader2, ListChecks, Hash, Globe, Mail, Phone,
  AlignLeft, AlignJustify, Calendar, Clock, Upload, Type, Info,
} from 'lucide-react';
import type { Question } from '@/features/surveys/types';
import { useSystemList } from '@/features/system-lists/hooks';
import { itemsToOptions } from '@/features/system-lists/utils';
import { toFa, cn } from '@/shared/lib/utils';

export function QuestionPreview({ question }: { question: Question }) {
  const { type, settings, options, system_list } = question;

  const { systemList, loading: listLoading } = useSystemList(system_list);

  const hasList = !!system_list;
  const listOptions = hasList && systemList ? itemsToOptions(systemList.items) : [];
  const effectiveOptions = hasList ? listOptions : options;
  const waitingForList = hasList && listLoading;

  switch (type) {
    // ─── Short text / contact ──────────────────────────────
    case 'SHORT_TEXT':
      return <InputShell icon={<Type size={12} />} placeholder={(settings.placeholder as string) || 'پاسخ کوتاه...'} />;
    case 'EMAIL':
      return <InputShell icon={<Mail size={12} />} placeholder={(settings.placeholder as string) || 'you@example.com'} />;
    case 'PHONE':
      return <InputShell icon={<Phone size={12} />} placeholder={(settings.placeholder as string) || '+98 912 345 6789'} />;
    case 'URL':
      return <InputShell icon={<Globe size={12} />} placeholder={(settings.placeholder as string) || 'https://example.com'} />;
    case 'NUMBER':
      return <InputShell icon={<Hash size={12} />} placeholder="عدد وارد کنید..." />;

    // ─── Long text ─────────────────────────────────────────
    case 'LONG_TEXT':
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground/60 flex items-start gap-2 h-20">
          <AlignJustify size={12} className="mt-0.5 flex-shrink-0" />
          <span>{(settings.placeholder as string) || 'پاسخ بلند...'}</span>
        </div>
      );

    // ─── Date / Time ───────────────────────────────────────
    case 'DATE':
      return <InputShell icon={<Calendar size={12} />} placeholder="۱۴۰۴/۰۱/۰۱" />;
    case 'TIME':
      return <InputShell icon={<Clock size={12} />} placeholder="۱۲:۳۰" />;
    case 'DATETIME':
      return <InputShell icon={<Calendar size={12} />} placeholder="۱۴۰۴/۰۱/۰۱ - ۱۲:۳۰" />;

    // ─── Yes / No ──────────────────────────────────────────
    case 'YES_NO':
      return (
        <div className="flex gap-3 flex-wrap">
          <PreviewButton>بله</PreviewButton>
          <PreviewButton>خیر</PreviewButton>
        </div>
      );

    // ─── Choice types ──────────────────────────────────────
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
    case 'DROPDOWN':
    case 'LIKERT':
    case 'RANKING':
      if (waitingForList) return <ListLoadingState />;
      return (
        <ChoicePreview
          type={type}
          options={effectiveOptions}
          hasList={hasList}
          systemListName={systemList?.name}
        />
      );

    // ─── Rating ────────────────────────────────────────────
    case 'RATING': {
      const max = (settings.max as number) || 5;
      return (
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: max }).map((_, i) => (
              <Star key={i} size={26} className="text-muted-foreground/30 fill-muted" />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            مقیاس ۱ تا {toFa(max)} ستاره
          </p>
        </div>
      );
    }

    // ─── NPS ───────────────────────────────────────────────
    case 'NPS':
      return (
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 11 }).map((_, i) => (
              <div
                key={i}
                className="w-9 h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground flex items-center justify-center"
              >
                {toFa(i)}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground max-w-md">
            <span>اصلاً احتمال ندارد</span>
            <span>قطعاً توصیه می‌کنم</span>
          </div>
        </div>
      );

    // ─── Linear / Slider ───────────────────────────────────
    case 'LINEAR_SCALE':
    case 'SLIDER': {
      const min = (settings.min as number) ?? 0;
      const max = (settings.max as number) ?? 10;
      const count = max - min + 1;

      if (count > 20) {
        return (
          <div className="space-y-2 max-w-md">
            <input type="range" min={min} max={max} disabled className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{toFa(min)}</span>
              <span>{toFa(max)}</span>
            </div>
          </div>
        );
      }

      return (
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="w-9 h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground flex items-center justify-center"
            >
              {toFa(min + i)}
            </div>
          ))}
        </div>
      );
    }

    // ─── File upload ───────────────────────────────────────
    case 'FILE_UPLOAD':
      return (
        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center max-w-md">
          <Upload size={24} className="text-muted-foreground/60 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            فایل‌ها را اینجا رها کنید
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            حداکثر ۵ فایل · هر فایل تا ۱۰ مگابایت
          </p>
        </div>
      );

    // ─── Matrix ────────────────────────────────────────────
    case 'MATRIX': {
      const rows = question.matrix_rows ?? [];
      const cols = question.matrix_columns ?? [];

      if (rows.length === 0 || cols.length === 0) {
        return (
          <div className="text-xs text-muted-foreground border border-dashed border-destructive/40 rounded-xl p-4 text-center max-w-md">
            ⚠️ ماتریس ناقص است — از پنل راست ردیف و ستون اضافه کنید
          </div>
        );
      }

      return (
        <div className="overflow-x-auto rounded-lg border border-border max-w-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="p-2 text-right"></th>
                {cols.slice(0, 5).map((c) => (
                  <th
                    key={c.id}
                    className="p-2 text-center text-[10px] font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 4).map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-muted/10' : ''}>
                  <td className="p-2 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                    {r.label}
                  </td>
                  {cols.slice(0, 5).map((c) => (
                    <td key={c.id} className="p-2 text-center">
                      <div className="w-4 h-4 rounded-full border-2 border-border inline-block" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(rows.length > 4 || cols.length > 5) && (
            <p className="text-[10px] text-muted-foreground px-2 py-1.5 border-t border-border bg-muted/20">
              {toFa(rows.length)} ردیف × {toFa(cols.length)} ستون
            </p>
          )}
        </div>
      );
    }

    // ─── TEXT_BLOCK ────────────────────────────────────────
    case 'TEXT_BLOCK': {
      const text = (settings.text as string) || question.title || '';
      return (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 max-w-md">
          <div className="flex items-start gap-2 mb-2">
            <AlignLeft size={12} className="text-primary mt-0.5 flex-shrink-0" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
              بلوک متن
            </span>
          </div>
          {text.trim() ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {text}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/60 italic">
              متن خالی است — روی کارت کلیک کنید و تایپ کنید
            </p>
          )}
        </div>
      );
    }

    // ─── SECTION ───────────────────────────────────────────
    case 'SECTION': {
      const text = (settings.text as string) || question.title || '';
      return (
        <div className="space-y-2 border-r-4 border-primary/50 pr-4 py-1 max-w-md">
          <div className="flex items-center gap-2">
            <Type size={12} className="text-primary flex-shrink-0" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
              بخش
            </span>
          </div>
          {text.trim() ? (
            <h3 className="text-base font-bold text-foreground">{text}</h3>
          ) : (
            <p className="text-base font-bold text-muted-foreground/60 italic">
              عنوان خالی است — روی کارت کلیک کنید
            </p>
          )}
          {question.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {question.description}
            </p>
          )}
        </div>
      );
    }

    // ─── Fallback ──────────────────────────────────────────
    default:
      return (
        <div className="flex items-center gap-2 bg-muted/30 border border-dashed border-border rounded-lg px-3 py-2 text-xs text-muted-foreground max-w-md">
          <Info size={12} />
          این نوع سوال پیش‌نمایش ندارد
        </div>
      );
  }
}

// ═════════════════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════════════════

function InputShell({
  icon,
  placeholder,
}: {
  icon?: React.ReactNode;
  placeholder: string;
}) {
  return (
    <div className="h-10 bg-card border border-border rounded-lg px-3 flex items-center gap-2 text-sm text-muted-foreground/60 max-w-md">
      {icon && <span className="text-muted-foreground/50">{icon}</span>}
      <span>{placeholder}</span>
    </div>
  );
}

function PreviewButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="px-6 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground cursor-default"
    >
      {children}
    </button>
  );
}

function ChoicePreview({
  type,
  options,
  hasList,
  systemListName,
}: {
  type: string;
  options: { id: string; label: string; value: string }[];
  hasList: boolean;
  systemListName?: string;
}) {
  const isMulti = type === 'MULTIPLE_CHOICE' || type === 'RANKING';
  const isDropdown = type === 'DROPDOWN';

  if (isDropdown) {
    return (
      <div className="space-y-2 max-w-md">
        {hasList && <ListBadge name={systemListName} />}
        <div className="h-10 bg-card border border-border rounded-lg px-3 flex items-center justify-between text-sm text-muted-foreground/60">
          <span>انتخاب کنید...</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {options.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {toFa(options.length)} گزینه موجود
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-md">
      {hasList && <ListBadge name={systemListName} />}
      {options.slice(0, 4).map((o) => (
        <div
          key={o.id}
          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <div
            className={cn(
              'w-4 h-4 border-2 border-border flex-shrink-0',
              isMulti ? 'rounded' : 'rounded-full',
            )}
          />
          <span className="text-sm">{o.label}</span>
        </div>
      ))}
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {hasList ? 'لیست خالی است.' : 'هنوز گزینه‌ای اضافه نشده'}
        </p>
      )}
      {options.length > 4 && (
        <p className="text-[10px] text-muted-foreground pt-1">
          + {toFa(options.length - 4)} گزینه دیگر
        </p>
      )}
    </div>
  );
}

function ListBadge({ name }: { name?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-primary font-medium mb-1">
      <ListChecks size={11} />
      از لیست «{name ?? '...'}»
    </div>
  );
}

function ListLoadingState() {
  return (
    <div className="space-y-2 max-w-md">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40 animate-pulse"
        >
          <div className="w-4 h-4 rounded-full bg-muted" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Loader2 size={10} className="animate-spin" /> در حال بارگذاری لیست...
      </div>
    </div>
  );
}