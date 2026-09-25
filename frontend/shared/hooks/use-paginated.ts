'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Paginated } from '@/shared/types';

interface Options<T> {
  fetcher: (params: { page: number; page_size: number; [k: string]: unknown }) => Promise<Paginated<T>>;
  pageSize?: number;
  extraParams?: Record<string, unknown>;
  /** Debounce key — change triggers refetch */
  deps?: unknown[];
}

export function usePaginated<T>({
  fetcher,
  pageSize = 20,
  extraParams = {},
  deps = [],
}: Options<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetcher({ page, page_size: pageSize, ...extraParams });
      setItems(r.results);
      setTotal(r.count);
    } catch (e) {
      setError(e as Error);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, ...deps]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset page when deps change
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    items,
    total,
    page,
    pageSize,
    loading,
    error,
    setPage,
    reload: load,
  };
}