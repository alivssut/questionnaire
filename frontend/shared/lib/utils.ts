import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFa(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  try {
    const date = new Date(value);
    return toFa(
      new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date),
    );
  } catch {
    return '—';
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  try {
    const date = new Date(value);
    return toFa(
      new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date),
    );
  } catch {
    return '—';
  }
}

export function formatRelative(value?: string | null): string {
  if (!value) return '—';
  try {
    const date = new Date(value).getTime();
    const diff = Date.now() - date;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'همین حالا';
    if (min < 60) return `${toFa(min)} دقیقه پیش`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${toFa(hr)} ساعت پیش`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${toFa(day)} روز پیش`;
    return formatDate(value);
  } catch {
    return '—';
  }
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 300) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Normalize a media URL returned from the backend.
 * Handles the case where the backend returns a relative path
 * (e.g. "media/.../file.jpg") or an incorrect absolute URL
 * (e.g. "http://localhost:8000/api/v1/responses/media/...").
 */
export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Already an absolute correct URL for /media/
  if (/^https?:\/\/[^/]+\/media\//.test(url)) {
    return url;
  }

  // Absolute but wrong path (contains /api/v1/.../media/)
  const wrongAbsolute = url.match(/^(https?:\/\/[^/]+)\/.*?(\/media\/.*)$/);
  if (wrongAbsolute) {
    return `${wrongAbsolute[1]}${wrongAbsolute[2]}`;
  }

  // Relative path with or without leading slash
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
  const origin = apiBase.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');

  if (url.startsWith('/media/')) return `${origin}${url}`;
  if (url.startsWith('media/')) return `${origin}/${url}`;
  if (url.startsWith('/')) return `${origin}${url}`;
  return `${origin}/${url}`;
}