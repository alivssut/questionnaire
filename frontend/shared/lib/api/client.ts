import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

// ═════════════════════════════════════════════════════════════════
// Token storage (SSR-safe)
// ═════════════════════════════════════════════════════════════════

const ACCESS_KEY = 'formly.access';
const REFRESH_KEY = 'formly.refresh';

const isBrowser = typeof window !== 'undefined';

export const tokenStorage = {
  getAccess: (): string | null =>
    isBrowser ? localStorage.getItem(ACCESS_KEY) : null,
  getRefresh: (): string | null =>
    isBrowser ? localStorage.getItem(REFRESH_KEY) : null,
  set: (access: string, refresh: string): void => {
    if (!isBrowser) return;
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: (): void => {
    if (!isBrowser) return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ═════════════════════════════════════════════════════════════════
// Base URL resolution
// ═════════════════════════════════════════════════════════════════

/**
 * Resolve the API base URL from `NEXT_PUBLIC_API_URL`.
 *
 * Accepts any of these forms and normalizes to `/api/v1`:
 *   - http://localhost:8000             → http://localhost:8000/api/v1
 *   - http://localhost:8000/            → http://localhost:8000/api/v1
 *   - http://localhost:8000/api/v1      → http://localhost:8000/api/v1
 *   - http://localhost:8000/api/v1/     → http://localhost:8000/api/v1
 *   - http://localhost:8000/api/v2      → http://localhost:8000/api/v2
 */
function getBaseURL(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const cleaned = raw.replace(/\/+$/, '');

  // If the URL already ends with `/api/vN`, trust it and use as-is.
  // This future-proofs against API version bumps without code changes.
  if (/\/api\/v\d+$/.test(cleaned)) return cleaned;

  return `${cleaned}/api/v1`;
}

// ═════════════════════════════════════════════════════════════════
// Axios instance
// ═════════════════════════════════════════════════════════════════

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

// ═════════════════════════════════════════════════════════════════
// Request interceptor — attach access token
// ═════════════════════════════════════════════════════════════════

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ═════════════════════════════════════════════════════════════════
// Response interceptor — auto-refresh on 401 (single-flight)
// ═════════════════════════════════════════════════════════════════

const REFRESH_TIMEOUT_MS = 10_000;

/**
 * Single-flight refresh promise.
 *
 * While a refresh is in-flight, all concurrent 401s share the same promise
 * instead of firing multiple refresh requests (which would invalidate each
 * other because of `BLACKLIST_AFTER_ROTATION` in SimpleJWT).
 */
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;

  try {
    const { data } = await axios.post(
      `${apiClient.defaults.baseURL}/auth/refresh/`,
      { refresh },
      { timeout: REFRESH_TIMEOUT_MS },
    );

    // SimpleJWT may rotate the refresh token (ROTATE_REFRESH_TOKENS=True).
    // Prefer the new one; fall back to the old one if the backend didn't
    // return a new refresh (rotation disabled or not implemented).
    const nextAccess: string = data.access;
    const nextRefresh: string = data.refresh ?? refresh;

    tokenStorage.set(nextAccess, nextRefresh);
    return nextAccess;
  } catch {
    // Refresh failed → clear tokens so the user is logged out cleanly.
    tokenStorage.clear();
    return null;
  }
}

/** Guard so multiple concurrent 401s don't trigger multiple redirects. */
let isRedirecting = false;

/** Redirect to login, preserving the current path via `?next=`. */
function redirectToLogin(): void {
  if (!isBrowser || isRedirecting) return;
  if (window.location.pathname.startsWith('/login')) return;

  isRedirecting = true;

  const next = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  // `replace` avoids polluting browser history — pressing Back should not
  // return to the page that just failed authentication.
  window.location.replace(`/login?next=${next}`);
}

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;

    const isUnauthorized = error.response?.status === 401;
    const isRefreshCall = original?.url?.includes('/auth/refresh');
    const alreadyRetried = original?._retry === true;

    if (!original || !isUnauthorized || isRefreshCall || alreadyRetried) {
      return Promise.reject(error);
    }

    original._retry = true;

    // Single-flight: share one refresh across all concurrent 401s.
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });

    const newToken = await refreshing;

    if (newToken) {
      // The token was already written to storage by `refreshAccessToken`,
      // so the request interceptor will attach it automatically when we
      // re-dispatch. No manual header mutation is needed here.
      return apiClient(original);
    }

    // Refresh failed → user is logged out.
    redirectToLogin();
    return Promise.reject(error);
  },
);

// ═════════════════════════════════════════════════════════════════
// Error message extraction (DRF-friendly)
// ═════════════════════════════════════════════════════════════════

type DrfErrorBody =
  | { detail?: unknown }
  | Record<string, unknown>
  | unknown[];

function firstStringFrom(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = firstStringFrom(item);
      if (s) return s;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const s = firstStringFrom(item);
      if (s) return s;
    }
    return null;
  }
  return null;
}

/**
 * Extract a human-friendly error message from a DRF response.
 *
 * Handles:
 *  - { detail: "..." }
 *  - { detail: ["..."] }
 *  - { field: ["..."] }
 *  - { field: { nested: ["..."] } }
 *  - [ "...", "..." ]
 *  - Network errors (no response)
 *  - Timeouts
 */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    // No response → network or timeout error.
    if (!err.response) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return 'زمان درخواست به پایان رسید. لطفاً دوباره تلاش کنید.';
      }
      if (err.code === 'ERR_NETWORK') {
        return 'اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.';
      }
      return 'خطا در ارتباط با سرور';
    }

    const data = err.response.data as DrfErrorBody | undefined;

    if (!data) {
      return 'خطا در ارتباط با سرور';
    }

    // Try `detail` first (DRF convention for generic errors).
    if (typeof data === 'object' && !Array.isArray(data)) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        const s = firstStringFrom(detail);
        if (s) return s;
      }
    }

    // Fall back to the first string anywhere in the payload.
    const fallback = firstStringFrom(data);
    if (fallback) return fallback;
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return 'خطای ناشناخته رخ داد';
}

export { axios };