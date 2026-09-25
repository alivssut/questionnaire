import { apiClient } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type { Paginated } from '@/shared/types';
import type { UserSummary } from './types';

// ─────────────────────────────────────────────────────────────
// Request payloads
// ─────────────────────────────────────────────────────────────

export interface ListUsersParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_verified?: boolean;
}

export interface BulkPatchPayload {
  is_active?: boolean;
  is_admin?: boolean;
  permissions?: string[];
}

export interface BulkResult {
  updated: number;
  failed: number;
}

export interface BulkDeleteResult {
  deactivated: number;
  failed: number;
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

export const usersApi = {
  /** List users with pagination + filters. */
  async list(params: ListUsersParams = {}): Promise<Paginated<UserSummary>> {
    const { data } = await apiClient.get<Paginated<UserSummary>>(endpoints.users, {
      params: { page_size: 20, ordering: '-created_at', ...params },
    });
    return data;
  },

  /** Get a single user. */
  async get(id: string): Promise<UserSummary> {
    const { data } = await apiClient.get<UserSummary>(`${endpoints.users}${id}/`);
    return data;
  },

  /**
   * Bulk update users.
   * The backend has no bulk endpoint, so we send parallel PATCH requests
   * in small batches to avoid overwhelming the server.
   */
  async bulkUpdate(ids: string[], patch: BulkPatchPayload): Promise<BulkResult> {
    const BATCH_SIZE = 10;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((id) => apiClient.patch(`${endpoints.users}${id}/`, patch)),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') updated += 1;
        else failed += 1;
      }
    }

    return { updated, failed };
  },

  /**
   * Bulk delete users.
   * The backend uses soft-delete (deactivation) on DELETE, so this
   * doesn't actually remove rows.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    const BATCH_SIZE = 10;
    let deactivated = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((id) => apiClient.delete(`${endpoints.users}${id}/`)),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') deactivated += 1;
        else failed += 1;
      }
    }

    return { deactivated, failed };
  },

  /** Activate a user (shorthand). */
  async activate(id: string): Promise<UserSummary> {
    const { data } = await apiClient.patch<UserSummary>(
      `${endpoints.users}${id}/`,
      { is_active: true },
    );
    return data;
  },

  /** Deactivate a user (shorthand). */
  async deactivate(id: string): Promise<UserSummary> {
    const { data } = await apiClient.patch<UserSummary>(
      `${endpoints.users}${id}/`,
      { is_active: false },
    );
    return data;
  },

  /** Grant admin permission (is_staff + is_superuser). */
  async promote(id: string): Promise<UserSummary> {
    const { data } = await apiClient.patch<UserSummary>(
      `${endpoints.users}${id}/`,
      { is_admin: true },
    );
    return data;
  },

  /** Revoke admin permission. */
  async demote(id: string): Promise<UserSummary> {
    const { data } = await apiClient.patch<UserSummary>(
      `${endpoints.users}${id}/`,
      { is_admin: false },
    );
    return data;
  },
};