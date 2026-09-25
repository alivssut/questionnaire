'use client';

import { useMemo } from 'react';
import { useAuth } from '@/shared/providers/auth-provider';
import type { AuthUser } from '@/features/auth/types';

export type UserRole = 'admin' | 'creator' | 'user';

/** Determine the current user's role from the auth context. */
export function getUserRole(user: AuthUser | null): UserRole {
  if (!user) return 'user';
  if (user.is_admin) return 'admin';
  if (user.permissions?.includes('can_create_survey')) return 'creator';
  return 'user';
}

/** Hook: get the current user's role. */
export function useUserRole(): UserRole {
  const { user } = useAuth();
  return useMemo(() => getUserRole(user), [user]);
}