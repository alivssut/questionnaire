import { apiClient } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type { Paginated } from '@/shared/types';
import type { Question, Survey, SurveyDetail, SurveyWritePayload } from './types';

interface ListParams {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
  ordering?: string;
}

export const surveysApi = {
  // ---------------- Surveys ----------------
  async list(params: ListParams = {}): Promise<Paginated<Survey>> {
    const { data } = await apiClient.get<Paginated<Survey>>(endpoints.surveys, { params });
    return data;
  },
  async mine(): Promise<Paginated<Survey>> {
    const { data } = await apiClient.get<Paginated<Survey>>(`${endpoints.surveys}mine/`);
    return data;
  },
  async detail(id: string): Promise<SurveyDetail> {
    const { data } = await apiClient.get<SurveyDetail>(`${endpoints.surveys}${id}/`);
    return data;
  },
  async create(payload: SurveyWritePayload): Promise<SurveyDetail> {
    const { data } = await apiClient.post<SurveyDetail>(endpoints.surveys, payload);
    return data;
  },
  async update(id: string, payload: Partial<SurveyWritePayload>): Promise<SurveyDetail> {
    const { data } = await apiClient.patch<SurveyDetail>(`${endpoints.surveys}${id}/`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`${endpoints.surveys}${id}/`);
  },
  async publish(id: string): Promise<SurveyDetail> {
    const { data } = await apiClient.post<SurveyDetail>(`${endpoints.surveys}${id}/publish/`);
    return data;
  },
  async close(id: string): Promise<void> {
    await apiClient.post(`${endpoints.surveys}${id}/close/`);
  },
  async archive(id: string): Promise<void> {
    await apiClient.post(`${endpoints.surveys}${id}/archive/`);
  },
  async duplicate(id: string): Promise<SurveyDetail> {
    const { data } = await apiClient.post<SurveyDetail>(`${endpoints.surveys}${id}/duplicate/`);
    return data;
  },

  // ---------------- Questions ----------------
  async createQuestion(payload: QuestionPayload): Promise<Question> {
    const { data } = await apiClient.post<Question>(endpoints.questions, payload);
    return data;
  },
  async updateQuestion(id: string, payload: QuestionPayload): Promise<Question> {
    const { data } = await apiClient.patch<Question>(`${endpoints.questions}${id}/`, payload);
    return data;
  },
  async deleteQuestion(id: string): Promise<void> {
    await apiClient.delete(`${endpoints.questions}${id}/`);
  },
  async reorderQuestions(items: { id: string; order: number }[]): Promise<void> {
    await apiClient.post(`${endpoints.questions}reorder/`, items);
  },
};

// Payload shape expected by backend's QuestionWriteSerializer
export interface QuestionPayload {
  survey: string;
  type: string;
  title: string;
  description?: string;
  required?: boolean;
  order?: number;
  settings?: Record<string, unknown>;
  system_list?: string | null;
  options?: { label: string; value: string; order?: number }[];
  matrix_rows?: { label: string; order?: number }[];
  matrix_columns?: { label: string; value: string; order?: number }[];
}