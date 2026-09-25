'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Edit,
  Eye,
  Users,
  BarChart3,
  Lock,
  Globe,
  CheckCircle2,
  Copy,
  Trash2,
  Loader2,
  XCircle,
  Archive,
} from 'lucide-react';

import type { Survey } from '../types';
import { SurveyStatusBadge } from './survey-status-badge';
import { Badge } from '@/shared/components/ui/badge';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { useAuth } from '@/shared/providers/auth-provider';
import { surveysApi } from '../api';
import { getErrorMessage } from '@/shared/lib/api/client';
import { toFa, formatDate, cn } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Props
// ═════════════════════════════════════════════════════════════════

interface Props {
  survey: Survey;
  /**
   * Optional: pass `true` when the current user has an assignment for
   * this survey. Used to show the "شروع پاسخ" button on ASSIGNED surveys.
   */
  hasAssignment?: boolean;

  /**
   * Optimistic callback — called immediately after a successful DELETE.
   * The parent should remove the survey from its local list.
   * If not provided, `onChanged` is called instead.
   */
  onDeleted?: (id: string) => void;

  /**
   * Optimistic callback — called immediately after a successful UPDATE
   * (e.g. close, archive). The parent should replace the survey in its
   * local list with the returned object.
   * If not provided, `onChanged` is called instead.
   */
  onUpdated?: (survey: Survey) => void;

  /**
   * Fallback — called after any successful mutation when no optimistic
   * callback is provided. The parent should refetch from the server.
   */
  onChanged?: () => void;
}

// ═════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════

export function SurveyCard({
  survey,
  hasAssignment = false,
  onDeleted,
  onUpdated,
  onChanged,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const [busy, setBusy] = useState<null | 'delete' | 'close' | 'duplicate'>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Derived flags
  // ─────────────────────────────────────────────────────────────

  const ownerId = (survey as Survey & { created_by?: string }).created_by;
  const isOwner =
    !!user &&
    (user.is_admin ||
      (!!ownerId && user.id === ownerId) ||
      (!!survey.created_by_email &&
        user.email?.toLowerCase() === survey.created_by_email.toLowerCase()));

  const hasCreatePermission = !!user?.permissions?.includes('can_create_survey');
  const canEdit = !!user && (user.is_admin || (isOwner && hasCreatePermission));

  const isPublic = survey.visibility === 'PUBLIC';
  const isAnonymous = survey.response_mode === 'ANONYMOUS';
  const isPublished = survey.status === 'PUBLISHED';

  const canAnswer =
    isPublished && !isOwner && (isPublic || hasAssignment);

  const isClosedOrArchived =
    survey.status === 'CLOSED' || survey.status === 'ARCHIVED';

  // ─────────────────────────────────────────────────────────────
  // Mutation helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Run a mutation with a busy state. On success, notify the parent via
   * the best available callback. Returns `true` if the mutation succeeded.
   */
  const runMutation = async (
    kind: 'delete' | 'close' | 'duplicate',
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> => {
    if (busy) return false;
    setBusy(kind);
    try {
      await action();
      toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const ok = await runMutation(
      'delete',
      () => surveysApi.remove(survey.id),
      'پرسشنامه حذف شد',
    );
    setConfirmDelete(false);

    if (ok) {
      // Prefer optimistic removal; fall back to a full refetch.
      if (onDeleted) onDeleted(survey.id);
      else onChanged?.();
    }
  };

  const handleClose = async () => {
    // The backend's `close` action returns 200 with just a message,
    // so we optimistically build an updated copy from the current data.
    const ok = await runMutation(
      'close',
      () => surveysApi.close(survey.id),
      'پرسشنامه بسته شد',
    );

    if (ok) {
      const updated: Survey = { ...survey, status: 'CLOSED' };
      if (onUpdated) onUpdated(updated);
      else onChanged?.();
    }
  };

  const handleArchive = async () => {
    const ok = await runMutation(
      'close',
      () => surveysApi.archive(survey.id),
      'پرسشنامه بایگانی شد',
    );

    if (ok) {
      const updated: Survey = { ...survey, status: 'ARCHIVED' };
      if (onUpdated) onUpdated(updated);
      else onChanged?.();
    }
  };

  const handleDuplicate = async () => {
    let newId: string | null = null;

    const ok = await runMutation(
      'duplicate',
      async () => {
        const created = await surveysApi.duplicate(survey.id);
        newId = created.id;
      },
      'پرسشنامه کپی شد',
    );

    if (ok && newId) {
      // Duplicate creates a new item — the current list doesn't change.
      // Optionally notify the parent in case it wants to refresh totals.
      onChanged?.();
      router.push(`/builder/${newId}`);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={cn(
          'bg-card rounded-2xl border border-border p-5 transition-all group flex flex-col',
          'hover:shadow-md hover:border-primary/30',
          busy && 'opacity-70 pointer-events-none',
        )}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <SurveyStatusBadge status={survey.status} />

              {survey.category && (
                <span className="text-[10px] text-muted-foreground">
                  {survey.category}
                </span>
              )}

              {isPublic ? (
                <Badge variant="info" className="gap-1">
                  <Globe size={10} /> عمومی
                </Badge>
              ) : (
                <Badge variant="muted" className="gap-1">
                  <Lock size={10} /> تخصیصی
                </Badge>
              )}

              {isAnonymous && <Badge variant="warning">ناشناس</Badge>}
            </div>

            <h3 className="text-sm font-bold leading-snug line-clamp-2">
              {survey.title}
            </h3>
          </div>
        </div>

        {/* ── Description ────────────────────────────────────── */}
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2rem]">
          {survey.description || 'بدون توضیحات'}
        </p>

        {/* ── Stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-muted/50 rounded-xl">
            <div className="text-base font-bold">
              {toFa(survey.questions_count)}
            </div>
            <div className="text-[10px] text-muted-foreground">سوال</div>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-xl">
            <div className="text-base font-bold">
              {toFa(survey.estimated_time_minutes)}
            </div>
            <div className="text-[10px] text-muted-foreground">دقیقه</div>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-xl">
            <div className="text-xs font-medium mt-1">
              {formatDate(survey.updated_at)}
            </div>
            <div className="text-[10px] text-muted-foreground">بروزرسانی</div>
          </div>
        </div>

        <div className="flex-1" />

        {/* ── Actions ────────────────────────────────────────── */}
        {canEdit ? (
          <OwnerActions
            survey={survey}
            busy={busy}
            isClosedOrArchived={isClosedOrArchived}
            onDuplicate={handleDuplicate}
            onClose={handleClose}
            onArchive={handleArchive}
            onDelete={() => setConfirmDelete(true)}
          />
        ) : (
          <RespondentActions surveyId={survey.id} canAnswer={canAnswer} />
        )}
      </div>

      {/* ── Delete confirmation ──────────────────────────────── */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="حذف پرسشنامه"
        description={`پرسشنامه «${survey.title}» حذف شود؟ این عملیات قابل بازگشت نیست.`}
        confirmLabel="حذف"
        variant="danger"
      />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// Owner action bar
// ═════════════════════════════════════════════════════════════════

function OwnerActions({
  survey,
  busy,
  isClosedOrArchived,
  onDuplicate,
  onClose,
  onArchive,
  onDelete,
}: {
  survey: Survey;
  busy: null | 'delete' | 'close' | 'duplicate';
  isClosedOrArchived: boolean;
  onDuplicate: () => void;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const actionClass =
    'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none';

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      {/* Primary row: edit / preview / assign / analytics */}
      <div className="flex items-center gap-1">
        <Link href={`/builder/${survey.id}`} className={actionClass} title="ویرایش">
          <Edit size={12} /> ویرایش
        </Link>

        <Link
          href={`/answer/${survey.id}?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
          className={actionClass}
          title="پیش‌نمایش"
        >
          <Eye size={12} /> پیش‌نمایش
        </Link>

        <Link
          href={`/assignments?survey=${survey.id}`}
          className={actionClass}
          title="تخصیص"
        >
          <Users size={12} /> تخصیص
        </Link>

        <Link
          href={`/analytics?survey=${survey.id}`}
          className={actionClass}
          title="تحلیل"
        >
          <BarChart3 size={12} /> تحلیل
        </Link>
      </div>

      {/* Secondary row: duplicate / close / archive / delete */}
      <div className="flex items-center gap-1 pt-1 border-t border-border/60">
        <button
          type="button"
          onClick={onDuplicate}
          disabled={busy !== null}
          className={actionClass}
          title="کپی پرسشنامه"
        >
          {busy === 'duplicate' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Copy size={12} />
          )}
          کپی
        </button>

        {survey.status === 'PUBLISHED' && (
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            className={actionClass}
            title="بستن پرسشنامه"
          >
            {busy === 'close' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <XCircle size={12} />
            )}
            بستن
          </button>
        )}

        {isClosedOrArchived && survey.status !== 'ARCHIVED' && (
          <button
            type="button"
            onClick={onArchive}
            disabled={busy !== null}
            className={actionClass}
            title="بایگانی پرسشنامه"
          >
            <Archive size={12} /> بایگانی
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          disabled={busy !== null}
          className={cn(
            actionClass,
            'text-destructive/80 hover:text-destructive hover:bg-destructive/5',
          )}
          title="حذف پرسشنامه"
        >
          {busy === 'delete' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Trash2 size={12} />
          )}
          حذف
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Respondent action bar
// ═════════════════════════════════════════════════════════════════

function RespondentActions({
  surveyId,
  canAnswer,
}: {
  surveyId: string;
  canAnswer: boolean;
}) {
  return (
    <div className="flex items-center gap-1 pt-3 border-t border-border">
      {canAnswer ? (
        <Link
          href={`/answer/${surveyId}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors"
        >
          <CheckCircle2 size={12} /> شروع پاسخ
        </Link>
      ) : (
        <div className="flex-1 text-center py-2 text-xs text-muted-foreground">
          در دسترس نیست
        </div>
      )}
    </div>
  );
}