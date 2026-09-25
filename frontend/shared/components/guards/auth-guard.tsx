'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/shared/providers/auth-provider';
import { PageLoader } from '@/shared/components/ui/spinner';

/**
 * Wrap a page to require authentication.
 * Redirects to /login?next=<path> when not authenticated.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <PageLoader />;
  return <>{children}</>;
}