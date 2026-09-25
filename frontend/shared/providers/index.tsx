'use client';

import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { ThemeProvider } from './theme-provider';
import { AuthProvider } from './auth-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: 'inherit' } }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}