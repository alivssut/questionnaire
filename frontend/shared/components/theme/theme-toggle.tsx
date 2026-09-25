'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const options = [
  { value: 'light', icon: Sun, label: 'روشن' },
  { value: 'dark', icon: Moon, label: 'تاریک' },
  { value: 'system', icon: Monitor, label: 'سیستم' },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-[104px]" />;

  return (
    <div className="inline-flex items-center gap-0.5 bg-muted p-1 rounded-xl">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            theme === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}