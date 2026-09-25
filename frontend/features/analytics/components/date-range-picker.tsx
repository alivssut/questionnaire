'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn, toFa } from '@/shared/lib/utils';
import type { DatePreset, DateRange } from '../api';

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: '7d', label: '۷ روز' },
  { value: '14d', label: '۱۴ روز' },
  { value: '30d', label: '۳۰ روز' },
  { value: '90d', label: '۹۰ روز' },
  { value: '1y', label: '۱ سال' },
  { value: 'custom', label: 'سفارشی' },
];

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from ?? '');
  const [customTo, setCustomTo] = useState(value.to ?? '');

  const activePreset = value.preset ?? null;

  const applyCustom = () => {
    onChange({
      preset: 'custom',
      from: customFrom || undefined,
      to: customTo || undefined,
    });
    setOpen(false);
  };

  const clear = () => {
    onChange({});
    setCustomFrom('');
    setCustomTo('');
    setOpen(false);
  };

  const label = (() => {
    if (activePreset === 'custom' && (value.from || value.to)) {
      return `${value.from ?? '...'} → ${value.to ?? '...'}`;
    }
    const p = PRESETS.find((x) => x.value === activePreset);
    return p ? `بازه: ${p.label}` : 'همه‌ی زمان‌ها';
  })();

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="md"
        onClick={() => setOpen((v) => !v)}
        className="gap-2"
      >
        <Calendar size={14} />
        {label}
        <ChevronDown
          size={12}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-popover border border-border rounded-2xl shadow-lg p-4 z-50 space-y-3">
          {/* Presets */}
          <div>
            <p className="text-xs font-semibold mb-2 text-muted-foreground">
              بازه‌های آماده
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => {
                    onChange({ preset: p.value });
                    if (p.value !== 'custom') setOpen(false);
                  }}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all',
                    activePreset === p.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-accent',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom */}
          {activePreset === 'custom' && (
            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                بازه سفارشی
              </p>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                  از تاریخ
                </label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                  تا تاریخ
                </label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
              <Button size="sm" className="w-full" onClick={applyCustom}>
                اعمال بازه
              </Button>
            </div>
          )}

          {/* Clear */}
          {activePreset && (
            <button
              onClick={clear}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors border-t border-border pt-3"
            >
              <X size={11} /> حذف فیلتر
            </button>
          )}
        </div>
      )}
    </div>
  );
}