'use client';

import { cn } from '@/shared/lib/utils';

export function SingleChoiceInput({
  options, value, onChange,
}: { options: { id: string; label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3 max-w-lg">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.value)}
            className={cn(
              'w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-right transition-all',
              selected
                ? 'border-primary bg-primary/5 text-foreground'
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