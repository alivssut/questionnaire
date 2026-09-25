import { apiClient } from '@/shared/lib/api/client';
import { endpoints } from '@/shared/lib/api/endpoints';
import type {
  AnswerFile,
  SaveDraftPayload,
  SurveyResponse,
} from './types';

// ═════════════════════════════════════════════════════════════════
// Error translation
// ═════════════════════════════════════════════════════════════════

/** Translate known backend error messages to Persian. */
function translateBackendError(detail: string): string | null {
  const d = detail.toLowerCase();
  if (d.includes('deadline') || d.includes('past')) {
    return 'مهلت پاسخ به این پرسشنامه گذشته است.';
  }
  if (d.includes('already submitted')) {
    return 'شما قبلاً به این پرسشنامه پاسخ داده‌اید.';
  }
  if (d.includes('not open') || d.includes('is not published')) {
    return 'این پرسشنامه در حال حاضر باز نیست.';
  }
  if (d.includes('no longer available')) {
    return 'این پرسشنامه دیگر در دسترس نیست.';
  }
  if (d.includes('not assigned')) {
    return 'شما به این پرسشنامه تخصیص داده نشده‌اید.';
  }
  if (d.includes('survey is closed')) {
    return 'این پرسشنامه بسته شده است.';
  }
  if (d.includes('file exceeds')) {
    return 'حجم فایل بیشتر از حد مجاز است.';
  }
  if (d.includes('unsupported file type')) {
    return 'نوع فایل پشتیبانی نمی‌شود.';
  }
  return null;
}

/** Extract a friendly Persian message from an axios error. */
function extractErrorMessage(err: unknown): Error {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const resp = (err as {
      response?: { data?: { detail?: unknown } };
    }).response;
    const detail = resp?.data?.detail;

    if (typeof detail === 'string') {
      const translated = translateBackendError(detail);
      if (translated) return new Error(translated);
    }
    if (Array.isArray(detail) && typeof detail[0] === 'string') {
      const translated = translateBackendError(detail[0]);
      if (translated) return new Error(translated);
      return new Error(detail[0]);
    }
  }
  return err instanceof Error ? err : new Error('خطای ناشناخته رخ داد');
}

// ═════════════════════════════════════════════════════════════════
// API
// ═════════════════════════════════════════════════════════════════

export const responsesApi = {
  /** Save or update a draft. Backend is idempotent per (user, survey). */
  async saveDraft(payload: SaveDraftPayload): Promise<SurveyResponse> {
    try {
      const { data } = await apiClient.post<SurveyResponse>(
        `${endpoints.responses}save-draft/`,
        payload,
      );
      return data;
    } catch (err) {
      throw extractErrorMessage(err);
    }
  },

  /** Submit a previously-saved draft. */
  async submit(responseId: string): Promise<SurveyResponse> {
    try {
      const { data } = await apiClient.post<SurveyResponse>(
        `${endpoints.responses}${responseId}/submit/`,
      );
      return data;
    } catch (err) {
      throw extractErrorMessage(err);
    }
  },

  /** Fetch the current user's draft for a given survey, if any. */
  async myDraft(surveyId: string): Promise<SurveyResponse | null> {
    try {
      const { data } = await apiClient.get<SurveyResponse>(
        `${endpoints.responses}my-draft/${surveyId}/`,
      );
      return data;
    } catch (err: unknown) {
      // 404 → no draft
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 404
      ) {
        return null;
      }
      throw err;
    }
  },

  /** Fetch a single response by ID (for detail view). */
  async detail(id: string): Promise<SurveyResponse> {
    const { data } = await apiClient.get<SurveyResponse>(
      `${endpoints.responses}${id}/`,
    );
    return data;
  },

  /**
   * Upload a single file for a FILE_UPLOAD question.
   * Returns the created AnswerFile record (with `id` and `url`).
   */
  async uploadFile(
    surveyId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<AnswerFile> {
    const form = new FormData();
    form.append('survey_id', surveyId);
    form.append('file', file);

    try {
      const { data } = await apiClient.post<AnswerFile>(
        `${endpoints.responses}upload/`,
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (!e.total || !onProgress) return;
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          },
        },
      );
      return data;
    } catch (err) {
      throw extractErrorMessage(err);
    }
  },
};