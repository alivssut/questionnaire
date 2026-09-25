'use client';

import { cn } from '@/shared/lib/utils';

export function YesNoInput({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-4">
      {[
        { v: 'yes', label: 'بله' },
        { v: 'no', label: 'خیر' },
      ].map((opt) => (
        <button
          key={opt.v}
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