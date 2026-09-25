'use client';

import { Check, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: CheckboxProps) {
  const isChecked = checked === true;
  const isIndet = checked === 'indeterminate';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isIndet ? 'mixed' : isChecked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!isChecked)}
      className={cn(
        'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
        isChecked || isIndet
          ? 'border-primary bg-primary'
          : 'border-border hover:border-primary/40',
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
    >
      {isChecked && <Check size={12} className="text-primary-foreground" />}
      {isIndet && <Minus size={12} className="text-primary-foreground" />}
    </button>
  );
}