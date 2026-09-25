export type NotificationType =
  | 'ASSIGNMENT_CREATED'
  | 'REMINDER'
  | 'COMPLETED'
  | 'SYSTEM';

export interface NotificationMetadata {
  assignment_id?: string;
  survey_id?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  metadata: NotificationMetadata;
  created_at: string;
}

export const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  { label: string; variant: 'info' | 'warning' | 'success' | 'default'; color: string }
> = {
  ASSIGNMENT_CREATED: {
    label: 'تخصیص جدید',
    variant: 'info',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  REMINDER: {
    label: 'یادآوری',
    variant: 'warning',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  COMPLETED: {
    label: 'تکمیل‌شده',
    variant: 'success',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  SYSTEM: {
    label: 'سیستمی',
    variant: 'default',
    color: 'bg-muted text-muted-foreground',
  },
};