import { apiClient } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type { Paginated } from '@/shared/types';
import type { Notification } from './types';

interface ListParams {
  page?: number;
  page_size?: number;
  type?: string;
  is_read?: boolean;
  ordering?: string;
}

export const notificationsApi = {
  async list(params: ListParams = {}): Promise<Paginated<Notification>> {
    const { data } = await apiClient.get<Paginated<Notification>>(
      endpoints.notifications,
      { params: { page_size: 50, ordering: '-created_at', ...params } },
    );
    return data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ unread: number }>(
      `${endpoints.notifications}unread-count/`,
    );
    return data.unread;
  },

  async markRead(id: string): Promise<Notification> {
    const { data } = await apiClient.post<Notification>(
      `${endpoints.notifications}${id}/read/`,
    );
    return data;
  },

  async markAllRead(): Promise<{ updated: number }> {
    const { data } = await apiClient.post<{ updated: number }>(
      `${endpoints.notifications}read-all/`,
    );
    return data;
  },
};