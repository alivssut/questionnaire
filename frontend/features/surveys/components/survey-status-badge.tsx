import { Badge } from '@/shared/components/ui/badge';
import type { SurveyStatus } from '../types';

const config: Record<SurveyStatus, { label: string; variant: 'success' | 'warning' | 'muted' | 'info' }> = {
  DRAFT: { label: 'پیش‌نویس', variant: 'muted' },
  PUBLISHED: { label: 'منتشرشده', variant: 'success' },
  CLOSED: { label: 'بسته‌شده', variant: 'warning' },
  ARCHIVED: { label: 'بایگانی', variant: 'info' },
};

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  const c = config[status] ?? config.DRAFT;
  return <Badge variant={c.variant}>{c.label}</Badge>;
}