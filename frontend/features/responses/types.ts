export type ResponseStatus = 'DRAFT' | 'SUBMITTED';

export interface ResponseUser {
  id: string;
  full_name: string;
  email: string;
}

export interface AnswerFile {
  id: string;
  url: string;
  original_name: string;
  content_type: string;
  size: number;
  order: number;
}

export interface AnswerRecord {
  id: string;
  response: string;
  question: string;
  value: Record<string, unknown>;
  files?: AnswerFile[];
}

export interface SurveyResponse {
  id: string;
  survey: string;
  user: ResponseUser | null;
  assignment: string | null;
  status: ResponseStatus;
  started_at: string;
  submitted_at: string | null;
  completion_time: string | null;
  answers: AnswerRecord[];
  created_at: string;
  updated_at: string;
}

export interface SaveDraftPayload {
  survey: string;
  assignment?: string | null;
  answers: Array<{
    question: string;
    value: Record<string, unknown>;
  }>;
}