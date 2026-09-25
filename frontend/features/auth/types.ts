export interface NotificationPreferences {
  email: boolean;
  assignments: boolean;
  reminders: boolean;
  completions: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email: true,
  assignments: true,
  reminders: false,
  completions: true,
};

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar: string | null;
  is_active: boolean;
  is_admin: boolean;
  is_verified: boolean;
  permissions: string[];
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  first_name?: string;
  last_name?: string;
  password: string;
  password2: string;
}

export interface AuthResponse {
  user: AuthUser;
  access?: string;
  refresh?: string;
}

export interface UpdateMePayload {
  first_name?: string;
  last_name?: string;
  avatar?: File | null;
  notification_preferences?: NotificationPreferences;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}