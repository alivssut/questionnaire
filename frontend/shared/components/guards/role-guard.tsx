'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/providers/auth-provider';
import { useUserRole, type UserRole } from '@/shared/hooks/use-user-role';
import { UnauthorizedView } from './unauthorized-view';
import { PageLoader } from '@/shared/components/ui/spinner';

interface Props {
  roles: UserRole[];
  children: React.ReactNode;
  /**
   * What to do when the role doesn't match:
   * - 'view'   → show a nice 403 page (default)
   * - 'redirect' → send the user to their own dashboard
   */
  fallback?: 'view' | 'redirect';
  /** For redirect mode: where to send the user. Default: /dashboard */
  redirectTo?: string;
}

export function RoleGuard({
  roles,
  children,
  fallback = 'view',
  redirectTo = '/dashboard',
}: Props) {
  const { isLoading } = useAuth();
  const role = useUserRole();
  const router = useRouter();

  const allowed = useMemo(() => roles.includes(role), [roles, role]);

  useEffect(() => {
    if (isLoading) return;
    if (!allowed && fallback === 'redirect') {
      router.replace(redirectTo);
    }
  }, [allowed, isLoading, fallback, redirectTo, router]);

  if (isLoading) return <PageLoader />;
  if (!allowed) {
    if (fallback === 'redirect') return <PageLoader />;
    return <UnauthorizedView />;
  }
  return <>{children}</>;
}