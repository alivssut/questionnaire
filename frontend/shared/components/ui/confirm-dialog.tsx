'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';
import { cn } from '@/shared/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  variant = 'default',
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
              variant === 'danger'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary',
            )}
          >
            <AlertTriangle size={22} />
          </div>
          <div className="flex-1 pt-1">
            <h2 className="text-base font-bold mb-1.5">{title}</h2>
            {description && (
              <div className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'destructive' : 'primary'}
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}