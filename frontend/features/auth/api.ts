import { apiClient } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type {
  AuthResponse,
  AuthUser,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  UpdateMePayload,
} from './types';

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      endpoints.auth.login,
      payload,
    );
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      endpoints.auth.register,
      payload,
    );
    return data;
  },

  async logout(refresh: string): Promise<void> {
    await apiClient.post(endpoints.auth.logout, { refresh });
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<AuthUser>(endpoints.auth.me);
    return data;
  },

  /**
   * Update the current user's profile.
   * Uses multipart when an avatar file is included.
   */
  async updateMe(payload: UpdateMePayload): Promise<AuthUser> {
    const hasFile = payload.avatar instanceof File;

    if (hasFile) {
      const form = new FormData();
      if (payload.first_name !== undefined)
        form.append('first_name', payload.first_name);
      if (payload.last_name !== undefined)
        form.append('last_name', payload.last_name);
      if (payload.avatar instanceof File) form.append('avatar', payload.avatar);
      if (payload.notification_preferences !== undefined) {
        form.append(
          'notification_preferences',
          JSON.stringify(payload.notification_preferences),
        );
      }

      const { data } = await apiClient.patch<AuthUser>(
        endpoints.auth.me,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    }

    // JSON path
    const body: Record<string, unknown> = {};
    if (payload.first_name !== undefined) body.first_name = payload.first_name;
    if (payload.last_name !== undefined) body.last_name = payload.last_name;
    if (payload.notification_preferences !== undefined) {
      body.notification_preferences = payload.notification_preferences;
    }

    const { data } = await apiClient.patch<AuthUser>(endpoints.auth.me, body);
    return data;
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await apiClient.post(endpoints.auth.changePassword, payload);
  },
};