/**
 * PDF export via the browser's native print dialog.
 * Beautiful, print-optimized HTML — no external dependencies.
 */

import type { Question } from '@/features/surveys/types';
import type { AnswerFile, AnswerRecord } from '@/features/responses/types';

// ═════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════

export interface PdfMeta {
  title: string;
  subtitle?: string;
  /** ISO date string. Defaults to now. */
  date?: string;
  /** Optional tags/badges displayed under the title */
  badges?: {
    label: string;
    color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  }[];
}

export interface PdfAnswerBlock {
  index: number;
  question: Question;
  answer?: AnswerRecord;
}

export interface PdfAnalyticsItem {
  index: number;
  title: string;
  type: string;
  counts?: Record<string, number>;
  count?: number;
  average?: number | null;
  matrixCounts?: Record<string, number>;
  filesUploaded?: number;
}

// ═════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toFa(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  try {
    return toFa(
      new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d),
    );
  } catch {
    return d.toISOString();
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${toFa(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toFa((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${toFa((bytes / 1024 / 1024).toFixed(2))} مگابایت`;
}

function formatDuration(duration: string | null): string {
  if (!duration) return '—';
  try {
    const parts = duration.split(' ');
    const timePart = parts[parts.length - 1];
    const [hStr, mStr, sStr] = timePart.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const s = Math.floor(parseFloat(sStr) || 0);
    if (h > 0) return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
    if (m > 0) return `${toFa(m)} دقیقه و ${toFa(s)} ثانیه`;
    return `${toFa(s)} ثانیه`;
  } catch {
    return '—';
  }
}

/**
 * Fix media URLs that the backend may return as relative or malformed.
 * Same logic as `shared/lib/utils.ts` — inlined to avoid coupling.
 */
function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Already correct absolute /media/
  if (/^https?:\/\/[^/]+\/media\//.test(url)) return url;

  // Wrong absolute path (e.g. includes /api/v1/.../media/)
  const wrong = url.match(/^(https?:\/\/[^/]+)\/.*?(\/media\/.*)$/);
  if (wrong) return `${wrong[1]}${wrong[2]}`;

  // Relative — resolve against API origin
  const apiBase =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
    'http://localhost:8000/api/v1';
  const origin = apiBase.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');

  if (url.startsWith('/media/')) return `${origin}${url}`;
  if (url.startsWith('media/')) return `${origin}/${url}`;
  if (url.startsWith('/')) return `${origin}${url}`;
  return `${origin}/${url}`;
}

function questionTypeLabel(t: string): string {
  const map: Record<string, string> = {
    SHORT_TEXT: 'متن کوتاه',
    LONG_TEXT: 'متن بلند',
    EMAIL: 'ایمیل',
    PHONE: 'تلفن',
    URL: 'لینک',
    NUMBER: 'عدد',
    RATING: 'امتیاز',
    LINEAR_SCALE: 'طیف خطی',
    NPS: 'NPS',
    SLIDER: 'اسلایدر',
    SINGLE_CHOICE: 'تک‌گزینه',
    MULTIPLE_CHOICE: 'چندگزینه',
    DROPDOWN: 'کشویی',
    YES_NO: 'بله/خیر',
    LIKERT: 'لیکرت',
    RANKING: 'رتبه‌بندی',
    DATE: 'تاریخ',
    TIME: 'ساعت',
    DATETIME: 'تاریخ و ساعت',
    MATRIX: 'ماتریس',
    FILE_UPLOAD: 'بارگذاری فایل',
    TEXT_BLOCK: 'بلوک متن',
    SECTION: 'بخش',
  };
  return map[t] ?? t;
}

const NON_ANSWERABLE = ['TEXT_BLOCK', 'SECTION'];

// ═════════════════════════════════════════════════════════════════
// Print styles (injected into the popup)
// ═════════════════════════════════════════════════════════════════

const PRINT_STYLES = `
  @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');

  @page {
    margin: 14mm 12mm;
    size: A4;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  body {
    font-family: 'Vazirmatn', system-ui, -apple-system, sans-serif;
    color: #0f172a;
    background: #ffffff;
    direction: rtl;
    line-height: 1.75;
    font-size: 12px;
  }

  /* ── Header ─────────────────────────────────────────── */
  .doc-header {
    padding-bottom: 14px;
    margin-bottom: 20px;
    border-bottom: 2px solid #6366f1;
    position: relative;
  }
  .doc-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .doc-brand-mark {
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 900;
    font-size: 14px;
  }
  .doc-brand-name {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
  }
  .doc-title {
    font-size: 22px;
    font-weight: 800;
    line-height: 1.3;
    color: #0f172a;
    margin-bottom: 6px;
  }
  .doc-subtitle {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 10px;
  }
  .doc-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
  }
  .badge--success { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .badge--warning { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .badge--danger  { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  .badge--info    { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  .doc-meta {
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* ── KPI cards ──────────────────────────────────────── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 24px;
  }
  .kpi-grid--3 { grid-template-columns: repeat(3, 1fr); }
  .kpi {
    padding: 12px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #f8fafc;
  }
  .kpi-label {
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 6px;
  }
  .kpi-value {
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1;
  }
  .kpi-hint {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 4px;
  }

  /* ── Sections ───────────────────────────────────────── */
  .section-title {
    font-size: 14px;
    font-weight: 800;
    color: #0f172a;
    margin: 24px 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .q-block {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 12px;
    page-break-inside: avoid;
    background: #ffffff;
  }
  .q-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px dashed #e2e8f0;
  }
  .q-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    background: #eef2ff;
    color: #4338ca;
    font-size: 11px;
    font-weight: 800;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .q-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    flex: 1;
  }
  .q-type {
    font-size: 10px;
    color: #94a3b8;
    flex-shrink: 0;
  }
  .q-desc {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 10px;
  }

  /* ── Answer values ──────────────────────────────────── */
  .answer-empty {
    font-size: 12px;
    color: #94a3b8;
    font-style: italic;
    padding: 6px 0;
  }
  .answer-text {
    font-size: 12px;
    color: #334155;
    white-space: pre-wrap;
    word-wrap: break-word;
    padding: 8px 12px;
    background: #f8fafc;
    border-radius: 8px;
    border-right: 3px solid #cbd5e1;
  }
  .answer-value {
    font-size: 14px;
    font-weight: 700;
    color: #4338ca;
    display: inline-block;
    padding: 4px 12px;
    background: #eef2ff;
    border-radius: 999px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: #eef2ff;
    color: #4338ca;
    font-size: 11px;
    font-weight: 600;
    border-radius: 999px;
  }
  .chip::before {
    content: '';
    width: 5px;
    height: 5px;
    background: #6366f1;
    border-radius: 999px;
  }

  /* ── Rating ─────────────────────────────────────────── */
  .rating-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rating-stars {
    display: flex;
    gap: 2px;
    font-size: 18px;
    color: #f59e0b;
    letter-spacing: 1px;
  }
  .rating-stars .empty { color: #e2e8f0; }
  .rating-value {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
  }

  /* ── NPS ────────────────────────────────────────────── */
  .nps-grid {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }
  .nps-cell {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    color: #94a3b8;
    background: #ffffff;
  }
  .nps-cell.selected {
    background: #6366f1;
    color: #ffffff;
    border-color: #6366f1;
    box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
  }

  /* ── Matrix answer ──────────────────────────────────── */
  .matrix-answer {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px 12px;
    padding: 10px 12px;
    background: #f8fafc;
    border-radius: 8px;
    font-size: 12px;
  }
  .matrix-answer .row { color: #64748b; }
  .matrix-answer .val { color: #0f172a; font-weight: 600; text-align: left; }

  /* ── File list ──────────────────────────────────────── */
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 11px;
  }
  .file-icon {
    width: 26px;
    height: 26px;
    background: #eef2ff;
    color: #4338ca;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 9px;
    flex-shrink: 0;
  }
  .file-name {
    flex: 1;
    color: #334155;
    font-weight: 500;
    word-break: break-all;
  }
  .file-size {
    color: #94a3b8;
    font-size: 10px;
    flex-shrink: 0;
  }

  /* ── Image grid ─────────────────────────────────────── */
  .img-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-top: 8px;
  }
  .img-grid--single {
    grid-template-columns: 1fr;
  }

  .img-cell {
    margin: 0;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    background: #f8fafc;
    page-break-inside: avoid;
  }
  .img-cell__frame {
    display: block;
    width: 100%;
    height: 180px;
    background: #f1f5f9;
    position: relative;
    overflow: hidden;
  }
  .img-grid--single .img-cell__frame {
    height: 320px;
  }
  .img-cell__frame img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
  .img-cell__frame.is-error {
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      repeating-linear-gradient(
        45deg,
        #f8fafc,
        #f8fafc 8px,
        #f1f5f9 8px,
        #f1f5f9 16px
      );
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
  }
  .img-cell__cap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    background: #ffffff;
    border-top: 1px solid #e2e8f0;
    font-size: 10px;
  }
  .img-cell__name {
    flex: 1;
    color: #334155;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .img-cell__size {
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .img-cell__type {
    display: inline-block;
    padding: 1px 6px;
    background: #eef2ff;
    color: #4338ca;
    border-radius: 4px;
    font-weight: 700;
    font-size: 9px;
    flex-shrink: 0;
  }

  /* ── Analytics bars ─────────────────────────────────── */
  .stat-row {
    display: grid;
    grid-template-columns: 1fr 60px 40px;
    gap: 8px;
    align-items: center;
    padding: 4px 0;
    font-size: 11px;
  }
  .stat-row .label {
    color: #334155;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stat-row .bar-wrap {
    height: 6px;
    background: #f1f5f9;
    border-radius: 999px;
    overflow: hidden;
  }
  .stat-row .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #a855f7);
    border-radius: 999px;
  }
  .stat-row .num {
    color: #64748b;
    font-weight: 600;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }

  .avg-box {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: 10px;
  }
  .avg-box .big {
    font-size: 28px;
    font-weight: 800;
    color: #4338ca;
    line-height: 1;
  }
  .avg-box .sub {
    font-size: 11px;
    color: #64748b;
  }

  /* ── Footer ─────────────────────────────────────────── */
  .doc-footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 10px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .doc-footer .page-note { font-style: italic; }

  /* ── Print-specific ─────────────────────────────────── */
  @media print {
    .no-print { display: none !important; }
    .q-block { break-inside: avoid; }
    .kpi-grid { break-inside: avoid; }
    .img-cell { break-inside: avoid; }
    a { color: #4338ca; text-decoration: none; }
  }
`;

// ═════════════════════════════════════════════════════════════════
// HTML builders
// ═════════════════════════════════════════════════════════════════

function renderHeader(meta: PdfMeta): string {
  const badges = (meta.badges ?? [])
    .map(
      (b) =>
        `<span class="badge badge--${b.color ?? 'default'}">${esc(b.label)}</span>`,
    )
    .join('');

  return `
    <header class="doc-header">
      <div class="doc-brand">
        <div class="doc-brand-mark">F</div>
        <div class="doc-brand-name">FORMly</div>
      </div>
      <h1 class="doc-title">${esc(meta.title)}</h1>
      ${meta.subtitle ? `<p class="doc-subtitle">${esc(meta.subtitle)}</p>` : ''}
      ${badges ? `<div class="doc-badges">${badges}</div>` : ''}
      <div class="doc-meta">
        <span>📅 ${formatDate(meta.date)}</span>
        <span>🔖 شناسه: ${esc(meta.title.slice(0, 8))}</span>
      </div>
    </header>
  `;
}

function renderFooter(): string {
  return `
    <footer class="doc-footer">
      <div>FORMly — پلتفرم نظرسنجی و پرسشنامه</div>
      <div class="page-note">تولید شده به‌صورت خودکار</div>
    </footer>
  `;
}

// ═════════════════════════════════════════════════════════════════
// Answer renderers per question type
// ═════════════════════════════════════════════════════════════════

function renderAnswer(q: Question, answer?: AnswerRecord): string {
  if (!answer) {
    return `<div class="answer-empty">به این سوال پاسخی داده نشده است.</div>`;
  }
  const v = (answer.value ?? {}) as Record<string, unknown>;

  switch (q.type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT': {
      const text = String(v.text ?? '').trim();
      if (!text) return `<div class="answer-empty">پاسخ خالی</div>`;
      return `<div class="answer-text">${esc(text)}</div>`;
    }

    case 'EMAIL':
    case 'PHONE':
    case 'URL':
    case 'DATE':
    case 'TIME':
    case 'DATETIME': {
      const val = String(v.value ?? '').trim();
      if (!val) return `<div class="answer-empty">پاسخ خالی</div>`;
      return `<span class="answer-value">${esc(val)}</span>`;
    }

    case 'NUMBER':
    case 'LINEAR_SCALE':
    case 'SLIDER': {
      const n = v.value;
      if (n === null || n === undefined || n === '')
        return `<div class="answer-empty">پاسخ خالی</div>`;
      return `<span class="answer-value">${toFa(Number(n))}</span>`;
    }

    case 'RATING': {
      const n = Number(v.value ?? 0);
      const max = (q.settings?.max as number) || 5;
      const filled = '★'.repeat(Math.min(n, max));
      const empty = '★'.repeat(Math.max(0, max - n));
      return `
        <div class="rating-row">
          <div class="rating-stars">
            <span>${filled}</span><span class="empty">${empty}</span>
          </div>
          <span class="rating-value">${toFa(n)} از ${toFa(max)}</span>
        </div>
      `;
    }

    case 'NPS': {
      const n = Number(v.value ?? -1);
      const cells = Array.from({ length: 11 })
        .map(
          (i) =>
            `<div class="nps-cell ${i === n ? 'selected' : ''}">${toFa(i)}</div>`,
        )
        .join('');
      return `
        <div class="nps-grid">${cells}</div>
        ${
          n >= 0
            ? `<p style="margin-top:6px;font-size:11px;color:#64748b">امتیاز: <strong style="color:#0f172a">${toFa(n)}</strong></p>`
            : ''
        }
      `;
    }

    case 'SINGLE_CHOICE':
    case 'DROPDOWN':
    case 'LIKERT':
    case 'YES_NO': {
      const val = String(v.value ?? '').trim();
      if (!val) return `<div class="answer-empty">پاسخ خالی</div>`;
      const opt = q.options?.find((o) => o.value === val);
      const label =
        opt?.label ??
        (val === 'yes' ? 'بله' : val === 'no' ? 'خیر' : val);
      return `<span class="answer-value">${esc(label)}</span>`;
    }

    case 'MULTIPLE_CHOICE':
    case 'RANKING': {
      const values = (v.values as string[]) ?? [];
      if (values.length === 0)
        return `<div class="answer-empty">پاسخ خالی</div>`;
      const chips = values
        .map((val) => {
          const opt = q.options?.find((o) => o.value === val);
          return `<span class="chip">${esc(opt?.label ?? val)}</span>`;
        })
        .join('');
      return `<div class="chips">${chips}</div>`;
    }

    case 'MATRIX': {
      const cells = (v.value as Record<string, string>) ?? {};
      const entries = Object.entries(cells);
      if (entries.length === 0)
        return `<div class="answer-empty">پاسخی ثبت نشده است.</div>`;
      const rows = entries
        .map(([rowId, colVal]) => {
          const row = q.matrix_rows?.find((r) => r.id === rowId);
          const col = q.matrix_columns?.find((c) => c.value === colVal);
          return `
            <div class="row">${esc(row?.label ?? rowId)}</div>
            <div class="val">${esc(col?.label ?? colVal)}</div>
          `;
        })
        .join('');
      return `<div class="matrix-answer">${rows}</div>`;
    }

    case 'FILE_UPLOAD': {
      const files = (answer.files as AnswerFile[]) ?? [];
      if (files.length === 0)
        return `<div class="answer-empty">فایلی بارگذاری نشده است.</div>`;

      const images = files.filter((f) =>
        (f.content_type || '').startsWith('image/'),
      );
      const others = files.filter(
        (f) => !(f.content_type || '').startsWith('image/'),
      );

      let html = '';

      // ── Image grid ─────────────────────────────────────
      if (images.length > 0) {
        const gridClass =
          images.length === 1 ? 'img-grid img-grid--single' : 'img-grid';

        const cells = images
          .map((f) => {
            const url = normalizeMediaUrl(f.url);
            const ext = (f.original_name.split('.').pop() ?? 'img')
              .slice(0, 4)
              .toUpperCase();
            return `
              <figure class="img-cell">
                <span class="img-cell__frame">
                  <img
                    src="${esc(url)}"
                    alt="${esc(f.original_name)}"
                    loading="eager"
                    onerror="this.parentNode.classList.add('is-error'); this.parentNode.innerHTML='تصویر بارگذاری نشد';"
                  />
                </span>
                <figcaption class="img-cell__cap">
                  <span class="img-cell__type">${esc(ext)}</span>
                  <span class="img-cell__name" title="${esc(f.original_name)}">
                    ${esc(f.original_name)}
                  </span>
                  <span class="img-cell__size">${formatSize(f.size)}</span>
                </figcaption>
              </figure>
            `;
          })
          .join('');

        html += `<div class="${gridClass}">${cells}</div>`;
      }

      // ── Non-image file list ────────────────────────────
      if (others.length > 0) {
        const items = others
          .map((f) => {
            const ext = (f.original_name.split('.').pop() ?? '?')
              .slice(0, 3)
              .toUpperCase();
            return `
              <div class="file-item">
                <div class="file-icon">${esc(ext)}</div>
                <div class="file-name">${esc(f.original_name)}</div>
                <div class="file-size">${formatSize(f.size)}</div>
              </div>
            `;
          })
          .join('');
        html += `<div class="file-list">${items}</div>`;
      }

      return html;
    }

    default:
      return `<div class="answer-empty">نوع سوال پشتیبانی نمی‌شود (${esc(q.type)})</div>`;
  }
}

// ═════════════════════════════════════════════════════════════════
// Answer block (question + answer together)
// ═════════════════════════════════════════════════════════════════

function renderAnswerBlock(block: PdfAnswerBlock): string {
  const { index, question, answer } = block;
  const isContent = NON_ANSWERABLE.includes(question.type);

  // Content block
  if (isContent) {
    const text =
      (question.settings?.text as string) || question.title || '';
    if (!text.trim()) return '';

    if (question.type === 'SECTION') {
      return `
        <div class="q-block" style="background:#f8fafc;border-right:4px solid #6366f1">
          <div class="q-head">
            <span class="q-type">بخش</span>
          </div>
          <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:6px">
            ${esc(text)}
          </div>
          ${question.description ? `<div class="q-desc">${esc(question.description)}</div>` : ''}
        </div>
      `;
    }
    return `
      <div class="q-block" style="background:#fafafa">
        <div class="q-head"><span class="q-type">یادداشت</span></div>
        <div class="answer-text">${esc(text)}</div>
      </div>
    `;
  }

  return `
    <div class="q-block">
      <div class="q-head">
        <span class="q-num">${toFa(index)}</span>
        <span class="q-title">${esc(question.title)}</span>
        <span class="q-type">${esc(questionTypeLabel(question.type))}</span>
      </div>
      ${question.description ? `<div class="q-desc">${esc(question.description)}</div>` : ''}
      ${renderAnswer(question, answer)}
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════
// Analytics renderers
// ═════════════════════════════════════════════════════════════════

function renderAnalyticsItem(item: PdfAnalyticsItem): string {
  const numeric = ['NUMBER', 'RATING', 'LINEAR_SCALE', 'NPS', 'SLIDER'];
  const choice = [
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'DROPDOWN',
    'YES_NO',
    'LIKERT',
    'RANKING',
  ];

  let body = '';

  if (choice.includes(item.type) && item.counts) {
    const entries = Object.entries(item.counts);
    const total = entries.reduce((s, [, c]) => s + c, 0);
    body =
      entries.length === 0
        ? `<div class="answer-empty">پاسخی ثبت نشده است.</div>`
        : entries
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => {
              const pct = total > 0 ? (count / total) * 100 : 0;
              return `
                <div class="stat-row">
                  <div class="label" title="${esc(label)}">${esc(label)}</div>
                  <div class="bar-wrap">
                    <div class="bar-fill" style="width:${pct.toFixed(1)}%"></div>
                  </div>
                  <div class="num">${toFa(count)}</div>
                </div>
              `;
            })
            .join('');
  } else if (numeric.includes(item.type)) {
    body = `
      <div class="avg-box">
        <div>
          <div class="big">
            ${
              item.average !== null && item.average !== undefined
                ? toFa(item.average)
                : '—'
            }
          </div>
          <div class="sub">میانگین</div>
        </div>
        <div style="flex:1">
          <div class="sub">
            بر اساس ${toFa(item.count ?? 0)} پاسخ ثبت‌شده
          </div>
        </div>
      </div>
    `;
  } else if (item.type === 'MATRIX' && item.matrixCounts) {
    const entries = Object.entries(item.matrixCounts);
    if (entries.length === 0) {
      body = `<div class="answer-empty">پاسخی ثبت نشده است.</div>`;
    } else {
      const max = Math.max(...entries.map(([, c]) => c));
      body = entries
        .map(([key, count]) => {
          const [row, col] = key.split(':');
          const pct = (count / max) * 100;
          return `
            <div class="stat-row">
              <div class="label" title="${esc(row)} → ${esc(col)}">
                ردیف ${toFa(row.slice(0, 6))} → ${esc(col)}
              </div>
              <div class="bar-wrap">
                <div class="bar-fill" style="width:${pct.toFixed(1)}%"></div>
              </div>
              <div class="num">${toFa(count)}</div>
            </div>
          `;
        })
        .join('');
    }
  } else if (item.type === 'FILE_UPLOAD') {
    body = `
      <div class="avg-box">
        <div>
          <div class="big">${toFa(item.filesUploaded ?? 0)}</div>
          <div class="sub">فایل بارگذاری شده</div>
        </div>
      </div>
    `;
  } else {
    body = `<div class="answer-empty">داده‌ای برای این سوال موجود نیست.</div>`;
  }

  return `
    <div class="q-block">
      <div class="q-head">
        <span class="q-num">${toFa(item.index)}</span>
        <span class="q-title">${esc(item.title)}</span>
        <span class="q-type">${esc(questionTypeLabel(item.type))}</span>
      </div>
      ${body}
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════
// Core: open popup window and print
// ═════════════════════════════════════════════════════════════════

interface BuildOptions {
  meta: PdfMeta;
  body: string;
}

function buildPrintWindow({ meta, body }: BuildOptions): void {
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) {
    alert(
      'مرورگر پنجره‌ی چاپ را باز نکرد. لطفاً پاپ‌آپ‌ها را برای این سایت مجاز کنید.',
    );
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="fa">
    <head>
      <meta charset="utf-8" />
      <title>${esc(meta.title)}</title>
      <style>${PRINT_STYLES}</style>
    </head>
    <body>
      ${renderHeader(meta)}
      ${body}
      ${renderFooter()}
      <script>
        (function () {
          var printed = false;

          function trigger() {
            if (printed) return;
            printed = true;
            setTimeout(function () {
              window.focus();
              window.print();
            }, 350);
          }

          function waitForImages() {
            var imgs = document.querySelectorAll('img');
            if (!imgs.length) return Promise.resolve();
            return Promise.all(
              Array.prototype.map.call(imgs, function (img) {
                if (img.complete) return Promise.resolve();
                return new Promise(function (resolve) {
                  var done = false;
                  function finish() {
                    if (done) return;
                    done = true;
                    resolve();
                  }
                  img.addEventListener('load', finish);
                  img.addEventListener('error', finish);
                  // Hard timeout so we never hang
                  setTimeout(finish, 4000);
                });
              })
            );
          }

          function init() {
            waitForImages().then(trigger);
          }

          if (document.readyState === 'complete') init();
          else window.addEventListener('load', init);

          window.addEventListener('afterprint', function () {
            setTimeout(function () {
              window.close();
            }, 200);
          });
        })();
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

// ═════════════════════════════════════════════════════════════════
// Public API
// ═════════════════════════════════════════════════════════════════

/**
 * Download a response detail as a print-ready PDF.
 */
export function downloadResponseAsPDF(options: {
  surveyTitle: string;
  respondent?: string;
  respondentEmail?: string;
  status?: string;
  startedAt?: string;
  submittedAt?: string | null;
  completionTime?: string | null;
  questions: Question[];
  answers: Record<string, AnswerRecord>;
  totalAnswerable?: number;
}): void {
  const {
    surveyTitle,
    respondent,
    respondentEmail,
    status,
    startedAt,
    submittedAt,
    completionTime,
    questions,
    answers,
    totalAnswerable,
  } = options;

  const answerCount = Object.keys(answers).length;

  const kpis = `
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">پاسخ‌دهنده</div>
        <div class="kpi-value" style="font-size:13px">
          ${esc(respondent ?? 'ناشناس')}
        </div>
        ${
          respondentEmail
            ? `<div class="kpi-hint">${esc(respondentEmail)}</div>`
            : ''
        }
      </div>
      <div class="kpi">
        <div class="kpi-label">وضعیت</div>
        <div class="kpi-value" style="font-size:13px;color:${
          status === 'ارسال‌شده' ? '#047857' : '#b45309'
        }">
          ${esc(status ?? '—')}
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-label">زمان ارسال</div>
        <div class="kpi-value" style="font-size:12px">
          ${esc(submittedAt ? formatDate(submittedAt) : '—')}
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-label">مدت زمان</div>
        <div class="kpi-value" style="font-size:13px">
          ${esc(formatDuration(completionTime ?? null))}
        </div>
      </div>
    </div>
  `;

  let answerableIndex = 0;
  const blocks = questions
    .map((q) => {
      const isContent = NON_ANSWERABLE.includes(q.type);
      if (!isContent) answerableIndex += 1;
      return renderAnswerBlock({
        index: isContent ? 0 : answerableIndex,
        question: q,
        answer: answers[q.id],
      });
    })
    .filter((html) => html.trim() !== '')
    .join('');

  const summary = `
    <p style="font-size:11px;color:#64748b;margin-bottom:12px">
      ${toFa(answerCount)} پاسخ ثبت‌شده از ${toFa(
        totalAnswerable ?? answerableIndex,
      )} سوال
      · شروع: ${esc(startedAt ? formatDate(startedAt) : '—')}
    </p>
  `;

  buildPrintWindow({
    meta: {
      title: surveyTitle,
      subtitle: respondent ? `پاسخ ${respondent}` : undefined,
      badges: [
        {
          label: status ?? 'نامشخص',
          color: status === 'ارسال‌شده' ? 'success' : 'warning',
        },
      ],
    },
    body: kpis + summary + blocks,
  });
}

/**
 * Download survey analytics as a print-ready PDF.
 */
export function downloadAnalyticsAsPDF(options: {
  surveyTitle: string;
  responsesCount: number;
  completionRate: number;
  averageTimeMinutes: number;
  totalAssigned: number;
  completedAssignments: number;
  generatedAt: string;
  distribution: PdfAnalyticsItem[];
}): void {
  const {
    surveyTitle,
    responsesCount,
    completionRate,
    averageTimeMinutes,
    totalAssigned,
    completedAssignments,
    generatedAt,
    distribution,
  } = options;

  const kpis = `
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">پاسخ‌ها</div>
        <div class="kpi-value">${toFa(responsesCount)}</div>
        <div class="kpi-hint">مجموع پاسخ‌های ارسالی</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">نرخ تکمیل</div>
        <div class="kpi-value">${toFa(completionRate)}٪</div>
        <div class="kpi-hint">
          ${toFa(completedAssignments)} از ${toFa(totalAssigned)} تخصیص
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-label">میانگین زمان</div>
        <div class="kpi-value">${toFa(averageTimeMinutes)}</div>
        <div class="kpi-hint">دقیقه به‌طور میانگین</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">تخصیص‌ها</div>
        <div class="kpi-value">${toFa(totalAssigned)}</div>
        <div class="kpi-hint">تعداد کل</div>
      </div>
    </div>
  `;

  const distributionHtml =
    distribution.length === 0
      ? `<div class="answer-empty">هنوز سوالی برای تحلیل وجود ندارد.</div>`
      : distribution.map(renderAnalyticsItem).join('');

  const sectionTitle = `
    <h2 class="section-title">
      <span>📊</span> تحلیل سوال‌به‌سوال
    </h2>
  `;

  buildPrintWindow({
    meta: {
      title: surveyTitle,
      subtitle: 'گزارش تحلیلی پاسخ‌ها',
      date: generatedAt,
      badges: [{ label: 'گزارش تحلیلی', color: 'info' }],
    },
    body: kpis + sectionTitle + distributionHtml,
  });
}

/**
 * Simple text-only PDF (kept for backward compatibility).
 */
export function downloadTextPDF(
  lines: { label: string; value: string }[],
  title: string,
  _filename: string,
): void {
  const rows = lines
    .map(
      (l) => `
        <div class="q-block">
          <div class="q-head">
            <span class="q-title">${esc(l.label)}</span>
          </div>
          <div class="answer-value" style="font-size:13px">
            ${esc(l.value)}
          </div>
        </div>
      `,
    )
    .join('');

  buildPrintWindow({
    meta: { title, subtitle: 'گزارش متنی' },
    body: rows,
  });
}

/**
 * Legacy: render a DOM element via cloning. Kept for backward compatibility.
 * Prefer `downloadResponseAsPDF` / `downloadAnalyticsAsPDF` for better output.
 */
export async function downloadElementAsPDF(
  element: HTMLElement,
  filename: string,
  _orientation: 'portrait' | 'landscape' = 'portrait',
): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print').forEach((el) => el.remove());
  buildPrintWindow({
    meta: { title: filename.replace(/\.pdf$/i, '').replace(/-/g, ' ') },
    body: clone.outerHTML,
  });
}