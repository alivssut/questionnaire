'use client';

import { X, Filter } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface CrossFilter {
  questionId: string;
  questionTitle: string;
  value: string;
  label: string;
}

interface Props {
  filters: CrossFilter[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

export function CrossFilterChips({ filters, onRemove, onClear }: Props) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap p-3 rounded-2xl bg-primary/5 border border-primary/20">
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Filter size={12} />
        فیلترهای فعال:
      </div>
      {filters.map((f, i) => (
        <button
          key={i}
          onClick={() => onRemove(i)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-primary/30 text-xs font-medium hover:bg-primary/10 transition-colors group"
          title={`${f.questionTitle} — برای حذف کلیک کنید`}
        >
          <span className="text-muted-foreground truncate max-w-[120px]">
            {f.questionTitle}
          </span>
          <span className="text-primary font-bold">{f.label}</span>
          <X
            size={11}
            className="text-muted-foreground group-hover:text-destructive"
          />
        </button>
      ))}
      <button
        onClick={onClear}
        className="ml-auto text-xs text-muted-foreground hover:text-destructive"
      >
        حذف همه
      </button>
    </div>
  );
}