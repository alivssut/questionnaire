'use client';

import { cn } from '@/shared/lib/utils';

interface TabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  items: { value: T; label: string; count?: number }[];
  className?: string;
}

export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
}: TabsProps<T>) {
  return (
    <div className={cn('inline-flex items-center gap-1 bg-muted p-1 rounded-xl', className)}>
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onValueChange(item.value)}
          className={cn(
            'px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5',
            value === item.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
          {typeof item.count === 'number' && (
            <span className="text-xs opacity-70">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}