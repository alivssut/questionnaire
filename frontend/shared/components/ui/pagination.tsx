'use client';

import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn, toFa } from '@/shared/lib/utils';

interface Props {
  page: number;              // 1-based
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}

/** Generate page numbers: 1 ... 4 5 [6] 7 8 ... 20 */
function pageList(current: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | '...')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('...');
  pages.push(totalPages);
  return pages;
}

export function Pagination({ page, pageSize, total, onChange, className }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-border mt-4',
        className,
      )}
    >
      <div className="text-xs text-muted-foreground">
        نمایش {toFa(start)} تا {toFa(end)} از {toFa(total)}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="قبلی"
        >
          <ChevronRight size={14} />
        </button>

        {pageList(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span
              key={`dots-${i}`}
              className="px-2 text-xs text-muted-foreground select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                'min-w-[32px] h-8 px-2 text-sm font-medium rounded-lg transition-all',
                p === page
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {toFa(p)}
            </button>
          ),
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="بعدی"
        >
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}

/** Helpers for paginated fetching */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export const PAGE_SIZE_OPTIONS = [20, 50, 100];