export type SurveyStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export type SurveyVisibility = 'PUBLIC' | 'ASSIGNED';
export type SurveyResponseMode = 'IDENTIFIED' | 'ANONYMOUS';

export interface Survey {
  id: string;
  title: string;
  description: string;
  category: string;
  status: SurveyStatus;
  visibility: SurveyVisibility;
  response_mode: SurveyResponseMode;
  estimated_time_minutes: number;
  created_by_email: string;
  questions_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface SurveyDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  cover_image: string | null;
  status: SurveyStatus;
  visibility: SurveyVisibility;
  response_mode: SurveyResponseMode;
  estimated_time_minutes: number;
  created_by: string;
  created_by_email: string;
  questions: Question[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface SurveyWritePayload {
  title?: string;
  description?: string;
  category?: string;
  visibility?: SurveyVisibility;
  response_mode?: SurveyResponseMode;
  estimated_time_minutes?: number;
}

export type QuestionType =
  | 'SHORT_TEXT' | 'LONG_TEXT' | 'EMAIL' | 'PHONE' | 'URL'
  | 'NUMBER' | 'RATING' | 'LINEAR_SCALE' | 'NPS' | 'SLIDER'
  | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DROPDOWN' | 'YES_NO' | 'LIKERT'
  | 'RANKING' | 'DATE' | 'TIME' | 'DATETIME' | 'MATRIX'
  | 'FILE_UPLOAD' | 'TEXT_BLOCK' | 'SECTION';

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  order: number;
}

export interface MatrixRow {
  id: string;
  label: string;
  order: number;
}

export interface MatrixColumn {
  id: string;
  label: string;
  value: string;
  order: number;
}

export interface Question {
  id: string;
  survey: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  order: number;
  settings: Record<string, unknown>;
  system_list: string | null;
  options: QuestionOption[];
  matrix_rows: MatrixRow[];
  matrix_columns: MatrixColumn[];
  created_at?: string;
  updated_at?: string;
}