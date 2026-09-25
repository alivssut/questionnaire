'use client';

import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function MultipleChoiceInput({
  options, value, onChange,
}: { options: { id: string; label: string; value: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="space-y-3 max-w-lg">
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.id}
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
              {selected && <Check size={12} className="text-primary-foreground" />}
            </div>
            <span className="text-base font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}