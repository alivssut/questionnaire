import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const ACCESS_KEY = 'formly.access';
const REFRESH_KEY = 'formly.refresh';

export const tokenStorage = {
  getAccess: () => (typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY)),
  getRefresh: () => (typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY)),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

function getBaseURL(): string {
    const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    const cleaned = raw.replace(/\/+$/, '');
    return cleaned.endsWith('/api/v1') ? cleaned : `${cleaned}/api/v1`;
  }
  
  export const apiClient = axios.create({
    baseURL: getBaseURL(),
    headers: { 'Content-Type': 'application/json' },
    timeout: 20_000,
  });

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401 (single-flight)
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(
      `${apiClient.defaults.baseURL}/auth/refresh/`,
      { refresh },
    );
    tokenStorage.set(data.access, refresh);
    return data.access;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return apiClient(original);
      }
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** Extract a human-friendly error message from DRF response. */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (!data) return 'خطا در ارتباط با سرور';
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data === 'object') {
      const first = Object.values(data)[0];
      if (Array.isArray(first)) return String(first[0]);
      if (typeof first === 'string') return first;
    }
  }
  return 'خطای ناشناخته رخ داد';
}

export { axios };