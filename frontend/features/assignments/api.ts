import { apiClient } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type { Paginated } from '@/shared/types';
import type { Assignment } from './types';

// ─────────────────────────────────────────────────────────────
// Request payloads
// ─────────────────────────────────────────────────────────────

export interface CreateAssignmentPayload {
  survey: string;
  user_id: string;
  due_date?: string | null;
  allow_resume?: boolean;
}

export interface BulkAssignPayload {
  survey: string;
  user_ids: string[];
  due_date?: string | null;
  allow_resume?: boolean;
}

export interface BulkAssignResponse {
  created: string[];
  skipped: Array<{ user_id: string; reason: string }>;
  missing_users: string[];
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

export const assignmentsApi = {
  async mine(): Promise<Paginated<Assignment>> {
    const { data } = await apiClient.get<Paginated<Assignment>>(
      `${endpoints.assignments}mine/`,
      { params: { page_size: 100 } },
    );
    return data;
  },

  async list(params: Record<string, unknown> = {}): Promise<Paginated<Assignment>> {
    const { data } = await apiClient.get<Paginated<Assignment>>(endpoints.assignments, {
      params: { page_size: 100, ...params },
    });
    return data;
  },

  async detail(id: string): Promise<Assignment> {
    const { data } = await apiClient.get<Assignment>(`${endpoints.assignments}${id}/`);
    return data;
  },

  async start(id: string): Promise<Assignment> {
    const { data } = await apiClient.post<Assignment>(
      `${endpoints.assignments}${id}/start/`,
    );
    return data;
  },

  /** Assign a survey to one user. */
  async create(payload: CreateAssignmentPayload): Promise<Assignment> {
    const { data } = await apiClient.post<Assignment>(endpoints.assignments, payload);
    return data;
  },

  /** Assign a survey to many users in a single request. */
  async bulkCreate(payload: BulkAssignPayload): Promise<BulkAssignResponse> {
    const { data } = await apiClient.post<BulkAssignResponse>(
      `${endpoints.assignments}bulk/`,
      payload,
    );
    return data;
  },

  /** Remove an assignment. */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`${endpoints.assignments}${id}/`);
  },
};