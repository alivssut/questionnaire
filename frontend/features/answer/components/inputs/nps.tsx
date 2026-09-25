'use client';

import { cn, toFa } from '@/shared/lib/utils';

export function NpsInput({
  value, onChange,
}: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 11 }).map((_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={cn(
              'w-12 h-12 rounded-xl font-semibold text-sm transition-all',
              value === i
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-card border-2 border-border text-muted-foreground hover:border-primary/40',
            )}
          >
            {toFa(i)}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-2 max-w-md">
        <span className="text-xs text-muted-foreground">اصلاً احتمال ندارد</span>
        <span className="text-xs text-muted-foreground">قطعاً توصیه می‌کنم</span>
      </div>
    </div>
  );
}