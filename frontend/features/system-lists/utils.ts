import type { ListItem } from './types';

/**
 * Convert a system list's items into the shape expected by answer inputs.
 * The backend already uses { id, label, value }, so this is mostly a passthrough
 * with order-based sorting.
 */
export function itemsToOptions(items: ListItem[]) {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((it) => ({
      id: it.id,
      label: it.label,
      value: it.value,
    }));
}