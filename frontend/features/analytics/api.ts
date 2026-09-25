import { apiClient } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';

// ═════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════

export type DatePreset = '7d' | '14d' | '30d' | '90d' | '1y' | 'custom';

export interface DateRange {
  preset?: DatePreset;
  from?: string;
  to?: string;
}

export interface GlobalStats {
  total_users: number;
  total_surveys: number;
  total_responses: number;
  total_assignments: number;
  completion_rate: number;
  generated_at: string;
}

export interface TimelinePoint {
  date: string;
  count: number;
}

export interface ComparisonBucket {
  responses: number;
  avg_minutes: number;
  completion_rate: number;
}

export interface Comparison {
  current: ComparisonBucket;
  previous: ComparisonBucket;
  delta: {
    responses?: number | null;
    avg_minutes?: number | null;
    completion_rate?: number | null;
  };
}

export interface QuestionDistribution {
  question_id: string;
  title: string;
  type: string;

  // Choice / ranking
  counts?: Record<string, number>;

  // Numeric
  count?: number;
  average?: number | null;
  min?: number | null;
  max?: number | null;
  histogram?: Record<string, number>;

  // Matrix
  matrix_counts?: Record<string, number>;

  // File upload
  files_uploaded?: number;
}

export interface SurveyAnalytics {
  survey_id: string;
  responses_count: number;
  average_completion_time_minutes: number;
  completion_rate: number;
  total_assigned: number;
  completed_assignments: number;
  question_distribution: QuestionDistribution[];
  timeline: TimelinePoint[];
  comparison: Comparison | null;
  generated_at: string;
  range: {
    preset: string | null;
    from: string | null;
    to: string | null;
  };
}

// ═════════════════════════════════════════════════════════════════
// API
// ═════════════════════════════════════════════════════════════════

function rangeToParams(range: DateRange = {}): Record<string, string> {
  const params: Record<string, string> = {};
  if (range.preset && range.preset !== 'custom') params.preset = range.preset;
  if (range.from) params.from = range.from;
  if (range.to) params.to = range.to;
  return params;
}

export const analyticsApi = {
  async global(): Promise<GlobalStats> {
    const { data } = await apiClient.get<GlobalStats>(endpoints.analytics.global);
    return data;
  },

  async survey(id: string, range: DateRange = {}): Promise<SurveyAnalytics> {
    const { data } = await apiClient.get<SurveyAnalytics>(
      endpoints.analytics.survey(id),
      { params: rangeToParams(range) },
    );
    return data;
  },

  /**
   * Export survey answers as CSV.
   * Triggers a browser download.
   */
  async exportCSV(id: string, range: DateRange = {}): Promise<void> {
    const response = await apiClient.get(
      `${endpoints.analytics.survey(id)}export/`,
      {
        params: rangeToParams(range),
        responseType: 'blob',
      },
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    const cd = response.headers['content-disposition'] as string | undefined;
    const filename =
      cd?.match(/filename="?([^"]+)"?/)?.[1] ?? `survey-${id}-responses.csv`;

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};