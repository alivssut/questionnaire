'use client';

import { useEffect, useState } from 'react';
import { systemListsApi } from './api';
import type { SystemList } from './types';

// Module-level cache so the same list isn't fetched twice.
const detailCache = new Map<string, SystemList>();
const inflight = new Map<string, Promise<SystemList>>();

/** Load all system lists (with items). */
export function useSystemLists() {
  const [data, setData] = useState<SystemList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    systemListsApi
      .list({ page_size: 100 })
      .then((res) => {
        if (!cancelled) setData(res.results);
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { systemLists: data, loading };
}

/** Load a single system list with its items. Cached across mounts. */
export function useSystemList(id: string | null) {
  const [data, setData] = useState<SystemList | null>(() =>
    id ? detailCache.get(id) ?? null : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setData(null);
      return;
    }

    const cached = detailCache.get(id);
    if (cached) {
      setData(cached);
      return;
    }

    setLoading(true);
    let cancelled = false;

    let promise = inflight.get(id);
    if (!promise) {
      promise = systemListsApi.detail(id);
      inflight.set(id, promise);
    }

    promise
      .then((res) => {
        detailCache.set(id, res);
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        inflight.delete(id);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { systemList: data, loading };
}