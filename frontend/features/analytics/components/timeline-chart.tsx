'use client';

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import type { TimelinePoint } from '../api';
import { toFa } from '@/shared/lib/utils';

interface Props {
  data: TimelinePoint[];
}

const MAX_BARS = 30;

export function TimelineChart({ data }: Props) {
  // If too many points, sample every Nth
  const sampled = useMemo(() => {
    if (data.length <= MAX_BARS) return data;
    const step = Math.ceil(data.length / MAX_BARS);
    return data.filter((_, i) => i % step === 0);
  }, [data]);

  const max = Math.max(1, ...sampled.map((p) => p.count));
  const total = sampled.reduce((sum, p) => sum + p.count, 0);

  if (sampled.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        داده‌ای برای این بازه وجود ندارد.
      </div>
    );
  }

  // Summary stats
  const avg = Math.round(total / sampled.length);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>
            مجموع:{' '}
            <span className="font-bold text-foreground">{toFa(total)}</span>
          </span>
          <span>
            میانگین روزانه:{' '}
            <span className="font-bold text-foreground">{toFa(avg)}</span>
          </span>
        </div>
        <span className="flex items-center gap-1 text-emerald-600 font-medium">
          <TrendingUp size={12} /> {toFa(sampled.length)} روز
        </span>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-1 h-40">
        {sampled.map((point, i) => {
          const height = (point.count / max) * 100;
          return (
            <div
              key={point.date}
              className="flex-1 group relative"
              style={{ height: '100%' }}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-md bg-gradient-to-t from-primary to-primary/60 transition-all hover:opacity-80 hover:from-primary hover:to-primary"
                style={{
                  height: `${Math.max(2, height)}%`,
                  opacity: 0.5 + (i / sampled.length) * 0.5,
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {toFa(point.count)} پاسخ
                <br />
                {point.date}
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels (first, middle, last) */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{sampled[0]?.date}</span>
        {sampled.length > 2 && (
          <span>{sampled[Math.floor(sampled.length / 2)]?.date}</span>
        )}
        <span>{sampled[sampled.length - 1]?.date}</span>
      </div>
    </div>
  );
}