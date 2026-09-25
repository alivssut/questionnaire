'use client';

import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn, toFa } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════

interface Props {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  /** Total number of items across all pages. */
  total: number;
  onChange: (page: number) => void;
  className?: string;
  /**
   * When true, the component always renders (even with a single page).
   * Useful on admin lists where you want a consistent footer. Defaults
   * to true — the previous behavior of hiding when `totalPages <= 1`
   * made it look like pagination was broken for small lists.
   */
  alwaysShow?: boolean;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

// ═════════════════════════════════════════════════════════════════
// Page-number builder
// ═════════════════════════════════════════════════════════════════
//
// Produces a compact list like:
//   [1, 2, 3, 4, '...', 20]        when current is near the start
//   [1, '...', 9, 10, 11, '...', 20] when current is in the middle
//   [1, '...', 17, 18, 19, 20]     when current is near the end
//
// The naive "current ± 1" version gave only 2 visible numbers near
// the edges, which looked broken.
// ═════════════════════════════════════════════════════════════════

const DOTS = '...' as const;
type PageItem = number | typeof DOTS;

function pageList(current: number, totalPages: number): PageItem[] {
  // Everything fits without ellipsis.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Near the start: show the first 4 + last.
  if (current <= 3) {
    return [1, 2, 3, 4, DOTS, totalPages];
  }

  // Near the end: show the first + last 4.
  if (current >= totalPages - 2) {
    return [
      1,
      DOTS,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  // Somewhere in the middle.
  return [1, DOTS, current - 1, current, current + 1, DOTS, totalPages];
}

// ═════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  className,
  alwaysShow = true,
}: Props) {
  // Nothing to paginate if there are no items at all.
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Opt-out: hide when there's only one page.
  if (!alwaysShow && totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;
  const singlePage = totalPages <= 1;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-border mt-4',
        className,
      )}
    >
      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        نمایش {toFa(start)} تا {toFa(end)} از {toFa(total)}
      </div>

      {/* Controls */}
      <div
        className={cn(
          'flex items-center gap-1',
          singlePage && 'opacity-60',
        )}
      >
        {/* Previous (RTL: chevron-right) */}
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={isFirst}
          aria-label="صفحه قبلی"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>

        {/* Page numbers */}
        {pageList(page, totalPages).map((item, i) =>
          item === DOTS ? (
            <span
              key={`dots-${i}`}
              aria-hidden="true"
              className="px-2 text-xs text-muted-foreground select-none"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              disabled={singlePage}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`صفحه ${item}`}
              className={cn(
                'min-w-[32px] h-8 px-2 text-sm font-medium rounded-lg transition-all',
                item === page
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                singlePage && 'cursor-default',
              )}
            >
              {toFa(item)}
            </button>
          ),
        )}

        {/* Next (RTL: chevron-left) */}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={isLast}
          aria-label="صفحه بعدی"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Page size options
// ═════════════════════════════════════════════════════════════════
//
// Includes small sizes so pagination is testable with a handful of
// records (e.g. 5 users with page_size=10 → 1 page, page_size=2 → 3
// pages).
// ═════════════════════════════════════════════════════════════════

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];