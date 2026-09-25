'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlay?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnOverlay = true,
}: ModalProps) {
  // Lock body scroll + Esc to close
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full bg-card border border-border rounded-2xl shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-150',
          'max-h-[90vh] flex flex-col',
          sizeClasses[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex-1 min-w-0">
              {title && <h2 className="text-base font-bold">{title}</h2>}
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 -mr-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              aria-label="بستن"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}