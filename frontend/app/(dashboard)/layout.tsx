'use client';

import { AppShell } from '@/shared/components/layout/app-shell';
import { AuthGuard } from '@/shared/components/guards/auth-guard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}