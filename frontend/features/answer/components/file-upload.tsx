'use client';

import { useRef, useState, type DragEvent } from 'react';
import {
  Upload, X, FileText, Loader2, AlertCircle, CheckCircle2, Eye,
} from 'lucide-react';
import { toast } from 'sonner';

import { responsesApi } from '@/features/responses/api';
import type { AnswerFile } from '@/features/responses/types';
import { Button } from '@/shared/components/ui/button';
import { getErrorMessage } from '@/shared/lib/api/client';
import { normalizeMediaUrl, cn, toFa } from '@/shared/lib/utils';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MAX_FILES = 5;
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface PendingUpload {
  tempId: string;
  file: File;
  progress: number;
  status: 'uploading' | 'error';
  error?: string;
}

interface Props {
  surveyId: string;
  value: AnswerFile[];
  onChange: (next: AnswerFile[]) => void;
  disabled?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FileUpload({ surveyId, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE_BYTES) {
      return `حجم فایل نباید بیشتر از ${toFa(MAX_SIZE_MB)} مگابایت باشد`;
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return `نوع فایل «${file.type}» پشتیبانی نمی‌شود`;
    }
    return null;
  };

  const canAddMore = value.length + pending.length < MAX_FILES;

  const uploadOne = async (file: File) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPending((prev) => [
      ...prev,
      { tempId, file, progress: 0, status: 'uploading' },
    ]);

    try {
      const uploaded = await responsesApi.uploadFile(surveyId, file, (pct) => {
        setPending((prev) =>
          prev.map((p) => (p.tempId === tempId ? { ...p, progress: pct } : p)),
        );
      });
      setPending((prev) => prev.filter((p) => p.tempId !== tempId));
      onChange([...value, { ...uploaded, order: value.length }]);
      toast.success(`«${uploaded.original_name}» بارگذاری شد`);
    } catch (err) {
      const msg = getErrorMessage(err);
      setPending((prev) =>
        prev.map((p) =>
          p.tempId === tempId ? { ...p, status: 'error', error: msg } : p,
        ),
      );
      toast.error(msg);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const remaining = MAX_FILES - value.length - pending.length;
    if (remaining <= 0) {
      toast.error(`حداکثر ${toFa(MAX_FILES)} فایل می‌توانید اضافه کنید`);
      return;
    }

    const toUpload = list.slice(0, remaining);
    if (toUpload.length < list.length) {
      toast.warning(
        `فقط ${toFa(remaining)} فایل اول اضافه شد (حداکثر ${toFa(MAX_FILES)} فایل)`,
      );
    }

    const valid: File[] = [];
    for (const f of toUpload) {
      const err = validateFile(f);
      if (err) toast.error(`${f.name}: ${err}`);
      else valid.push(f);
    }

    if (valid.length === 0) return;
    await Promise.allSettled(valid.map(uploadOne));
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && canAddMore) setDragActive(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
  };

  const onPick = () => inputRef.current?.click();
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void handleFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    onChange(value.filter((f) => f.id !== id));
  };

  const dismissError = (tempId: string) =>
    setPending((prev) => prev.filter((p) => p.tempId !== tempId));

  const retry = (tempId: string) => {
    const item = pending.find((p) => p.tempId === tempId);
    if (!item) return;
    setPending((prev) => prev.filter((p) => p.tempId !== tempId));
    void uploadOne(item.file);
  };

  const totalFiles = value.length + pending.length;
  const allDone = pending.every((p) => p.status !== 'uploading');

  return (
    <div className="space-y-3 max-w-lg">
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={!disabled && canAddMore ? onPick : undefined}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all px-6 py-8 text-center',
          disabled
            ? 'opacity-50 cursor-not-allowed border-border'
            : dragActive
            ? 'border-primary bg-primary/5 cursor-copy scale-[1.01]'
            : canAddMore
            ? 'border-border hover:border-primary/40 hover:bg-accent/30 cursor-pointer'
            : 'border-border opacity-60 cursor-not-allowed',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={onInputChange}
          disabled={disabled || !canAddMore}
          className="hidden"
          accept={Array.from(ALLOWED_MIME).join(',')}
        />

        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-all',
            dragActive
              ? 'bg-primary text-primary-foreground scale-110'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Upload size={22} />
        </div>

        {canAddMore ? (
          <>
            <p className="text-sm font-semibold mb-1">
              {dragActive ? 'فایل را رها کنید' : 'فایل‌ها را اینجا رها کنید'}
            </p>
            <p className="text-xs text-muted-foreground">
              یا برای انتخاب کلیک کنید
            </p>
            <p className="text-[10px] text-muted-foreground mt-2">
              حداکثر {toFa(MAX_FILES)} فایل · هر فایل تا {toFa(MAX_SIZE_MB)} مگابایت
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            حداکثر تعداد فایل ({toFa(MAX_FILES)}) رسیده است
          </p>
        )}
      </div>

      {/* List */}
      {totalFiles > 0 && (
        <div className="space-y-2">
          {value.map((f) => (
            <UploadedFileItem
              key={f.id}
              file={f}
              onRemove={disabled ? undefined : () => removeFile(f.id)}
            />
          ))}
          {pending.map((p) => (
            <PendingItem
              key={p.tempId}
              pending={p}
              onDismiss={() => dismissError(p.tempId)}
              onRetry={() => retry(p.tempId)}
            />
          ))}
        </div>
      )}

      {/* Footer status */}
      {totalFiles > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {toFa(totalFiles)} از {toFa(MAX_FILES)} فایل
          </span>
          {allDone && pending.length === 0 && value.length > 0 && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 size={11} /> آماده ارسال
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function UploadedFileItem({
  file,
  onRemove,
}: {
  file: AnswerFile;
  onRemove?: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isImage = file.content_type?.startsWith('image/') ?? false;
  const fixedUrl = normalizeMediaUrl(file.url);
  const showImage = isImage && !imgError && !!fixedUrl;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all">
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fixedUrl}
            alt={file.original_name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <FileText size={20} className="text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.original_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatSize(file.size)}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={fixedUrl || file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="مشاهده"
        >
          <Eye size={14} />
        </a>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="حذف"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function PendingItem({
  pending,
  onDismiss,
  onRetry,
}: {
  pending: PendingUpload;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const isError = pending.status === 'error';

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border bg-card',
        isError ? 'border-destructive/40' : 'border-border',
      )}
    >
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        {isError ? (
          <AlertCircle size={20} className="text-destructive" />
        ) : (
          <FileText size={20} className="text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{pending.file.name}</p>
        {isError ? (
          <p className="text-xs text-destructive mt-0.5 truncate">{pending.error}</p>
        ) : (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pending.progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-9 text-left">
              {toFa(pending.progress)}٪
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {isError ? (
          <>
            <Button size="sm" variant="ghost" onClick={onRetry} className="text-xs">
              تلاش مجدد
            </Button>
            <button
              onClick={onDismiss}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <Loader2 size={16} className="animate-spin text-primary" />
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${toFa(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toFa((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${toFa((bytes / 1024 / 1024).toFixed(2))} مگابایت`;
}