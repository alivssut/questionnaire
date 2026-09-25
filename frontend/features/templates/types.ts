import type { Survey } from '@/features/surveys/types';

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  questions_count: number;
  estimated_time_minutes: number;
  /** Optional color badge key */
  color?: string;
}

/** A survey can be used as a template if it has PUBLISHED status or belongs to a template category. */
export function surveyToTemplate(s: Survey): Template {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category || 'عمومی',
    questions_count: s.questions_count,
    estimated_time_minutes: s.estimated_time_minutes,
  };
}