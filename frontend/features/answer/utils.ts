import type { Question } from '@/features/surveys/types';
import type { AnswerFile } from '@/features/responses/types';
import type { AnswerValue } from './components/question-renderer';

/**
 * Convert a UI value into the backend's expected JSON shape.
 * Matches apps/q_responses/validators.py
 */
export function toBackendValue(
  question: Question,
  uiValue: AnswerValue,
): Record<string, unknown> {
  const t = question.type;

  // File upload: value is AnswerFile[] → send { file_ids: [...] }
  if (t === 'FILE_UPLOAD') {
    const files = (uiValue as AnswerFile[]) ?? [];
    return { file_ids: files.map((f) => f.id).filter(Boolean) };
  }

  // Text-ish
  if (t === 'SHORT_TEXT' || t === 'LONG_TEXT') {
    return { text: (uiValue as string) ?? '' };
  }

  // Single-value string types
  if (
    t === 'EMAIL' ||
    t === 'PHONE' ||
    t === 'URL' ||
    t === 'SINGLE_CHOICE' ||
    t === 'DROPDOWN' ||
    t === 'LIKERT' ||
    t === 'YES_NO'
  ) {
    return { value: uiValue ?? '' };
  }

  // Number-ish
  if (
    t === 'NUMBER' ||
    t === 'RATING' ||
    t === 'NPS' ||
    t === 'LINEAR_SCALE' ||
    t === 'SLIDER'
  ) {
    return { value: uiValue ?? 0 };
  }

  // Multi-select
  if (t === 'MULTIPLE_CHOICE' || t === 'RANKING') {
    return { values: Array.isArray(uiValue) ? uiValue : [] };
  }

  // Matrix
  if (t === 'MATRIX') {
    return { value: (uiValue as Record<string, string>) ?? {} };
  }

  // Date/time
  if (t === 'DATE' || t === 'TIME' || t === 'DATETIME') {
    return { value: uiValue ?? '' };
  }

  return { value: uiValue ?? '' };
}

/**
 * Convert a stored backend value back into the UI shape.
 * Used when loading an existing draft.
 *
 * For FILE_UPLOAD, prefer `files` (server-provided objects with URLs);
 * fall back to an empty array if not present.
 */
export function fromBackendValue(
  question: Question,
  backendValue: Record<string, unknown> | null | undefined,
  files?: AnswerFile[],
): AnswerValue {
  const t = question.type;

  if (t === 'FILE_UPLOAD') {
    return (files ?? []) as unknown as AnswerValue;
  }

  if (!backendValue) return null;

  if (t === 'SHORT_TEXT' || t === 'LONG_TEXT') {
    return (backendValue.text as string) ?? '';
  }

  if (Array.isArray(backendValue.values)) {
    return backendValue.values as string[];
  }

  if (backendValue.value !== undefined) {
    return backendValue.value as AnswerValue;
  }

  return null;
}

/** Is the UI value empty? (for optional questions) */
export function isEmpty(question: Question, v: AnswerValue): boolean {
  const t = question.type;

  if (t === 'SHORT_TEXT' || t === 'LONG_TEXT') {
    return !v || (typeof v === 'string' && v.trim() === '');
  }
  if (t === 'FILE_UPLOAD') {
    const arr = (v as AnswerFile[]) ?? [];
    return arr.length === 0;
  }
  if (t === 'MULTIPLE_CHOICE' || t === 'RANKING') {
    return !Array.isArray(v) || v.length === 0;
  }
  if (t === 'MATRIX') {
    return !v || typeof v !== 'object' || Object.keys(v as object).length === 0;
  }
  return v === null || v === undefined || v === '';
}