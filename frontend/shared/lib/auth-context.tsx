'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Role } from '@/shared/types';

interface AuthContextValue {
  user: User | null;
  login: (email: string, role: Role) => void;
  logout: () => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Demo users — replace with API call in production
const DEMO_USERS: Record<Role, User> = {
  admin: { id: '1', name: 'الکس مورگان', email: 'admin@formly.io', role: 'admin' },
  creator: { id: '2', name: 'سارا کیم', email: 'creator@formly.io', role: 'creator' },
  user: { id: '3', name: 'مارکوس چن', email: 'user@formly.io', role: 'user' },
};

const STORAGE_KEY = 'formly-user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
    setIsReady(true);
  }, []);

  const login = (_email: string, role: Role) => {
    const u = DEMO_USERS[role];
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}