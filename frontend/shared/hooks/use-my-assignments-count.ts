'use client';

import { useEffect, useState } from 'react';
import { assignmentsApi } from '@/features/assignments/api';

/**
 * Returns the number of assignments (pending + in-progress) that belong
 * to the current user. Used to decide whether "My Questionnaires" should
 * appear in the sidebar for admins/creators.
 *
 * Returns `null` while loading.
 */
export function useMyAssignmentsCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    assignmentsApi
      .mine()
      .then((r) => {
        if (cancelled) return;
        // Only count actionable assignments (not completed/overdue).
        const actionable = r.results.filter(
          (a) =>
            a.status !== 'COMPLETED' &&
            a.status !== 'OVERDUE' &&
            !a.is_past_due,
        ).length;
        setCount(actionable);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}