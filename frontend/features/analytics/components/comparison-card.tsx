'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { Comparison } from '../api';
import { cn, toFa } from '@/shared/lib/utils';

interface Props {
  comparison: Comparison;
}

function DeltaBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Minus size={10} /> —
      </span>
    );
  }
  const positive = value > 0;
  const neutral = value === 0;
  const Icon = neutral ? Minus : positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
        neutral
          ? 'bg-muted text-muted-foreground'
          : positive
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-red-500/10 text-red-600',
      )}
    >
      <Icon size={10} />
      {toFa(Math.abs(value))}٪
    </span>
  );
}

function Row({
  label,
  current,
  previous,
  delta,
  suffix = '',
}: {
  label: string;
  current: string | number;
  previous: string | number;
  delta: number | null | undefined;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-bold">
            {typeof current === 'number' ? toFa(current) : current}
            {suffix}
          </div>
          <div className="text-[10px] text-muted-foreground">
            قبلی:{' '}
            {typeof previous === 'number' ? toFa(previous) : previous}
            {suffix}
          </div>
        </div>
        <DeltaBadge value={delta} />
      </div>
    </div>
  );
}

export function ComparisonCard({ comparison }: Props) {
  const { current, previous, delta } = comparison;

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground mb-2">
        مقایسه با بازه‌ی قبلی (به همان طول)
      </p>
      <Row
        label="پاسخ‌ها"
        current={current.responses}
        previous={previous.responses}
        delta={delta.responses}
      />
      <Row
        label="میانگین زمان"
        current={current.avg_minutes}
        previous={previous.avg_minutes}
        delta={delta.avg_minutes}
        suffix=" دقیقه"
      />
      <Row
        label="نرخ تکمیل"
        current={current.completion_rate}
        previous={previous.completion_rate}
        delta={delta.completion_rate}
        suffix="٪"
      />
    </div>
  );
}