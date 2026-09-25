import { apiClient } from '@/shared/lib/api/client';
import type { Paginated } from '@/shared/types';
import type { SystemList } from './types';

const BASE = '/surveys/system-lists/';

export const systemListsApi = {
  async list(params: { type?: string; page_size?: number } = {}): Promise<Paginated<SystemList>> {
    const { data } = await apiClient.get<Paginated<SystemList>>(BASE, { params });
    return data;
  },
  async detail(id: string): Promise<SystemList> {
    const { data } = await apiClient.get<SystemList>(`${BASE}${id}/`);
    return data;
  },
};