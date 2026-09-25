'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Search,
  Users,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Modal } from '@/shared/components/ui/modal';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { UserAvatar } from '@/shared/components/ui/user-avatar';

import { surveysApi } from '@/features/surveys/api';
import type { Survey } from '@/features/surveys/types';
import { usersApi } from '@/features/users/api';
import { userRole, type UserSummary } from '@/features/users/types';
import {
  assignmentsApi,
  type BulkAssignResponse,
} from '@/features/assignments/api';
import { getErrorMessage } from '@/shared/lib/api/client';
import { cn, toFa } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-select a survey (when opened from a survey card). */
  initialSurveyId?: string | null;
}

export function AssignModal({
  open,
  onClose,
  onCreated,
  initialSurveyId,
}: Props) {
  // ── Form state ─────────────────────────────────────────────
  const [surveyId, setSurveyId] = useState<string>(initialSurveyId ?? '');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [dueDate, setDueDate] = useState<string>('');
  const [allowResume, setAllowResume] = useState(true);

  // ── Data state ─────────────────────────────────────────────
  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [loadingSurveys, setLoadingSurveys] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // ── Reset when modal opens/closes ──────────────────────────
  useEffect(() => {
    if (!open) return;
    setSurveyId(initialSurveyId ?? '');
    setSelectedUserIds(new Set());
    setDueDate('');
    setAllowResume(true);
    setUserSearch('');
  }, [open, initialSurveyId]);

  // ── Load published surveys ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (surveys !== null) return;

    setLoadingSurveys(true);
    surveysApi
      .list({ status: 'PUBLISHED', page_size: 100, ordering: '-updated_at' })
      .then((r) => setSurveys(r.results))
      .catch(() => setSurveys([]))
      .finally(() => setLoadingSurveys(false));
  }, [open, surveys]);

  // ── Load users ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (users !== null) return;

    setLoadingUsers(true);
    usersApi
      .list({ page_size: 200 })
      .then((r) => setUsers(r.results.filter((u) => u.is_active)))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [open, users]);

  // ── Filtered users ─────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const list = users ?? [];
    if (!userSearch.trim()) return list;
    const q = userSearch.trim().toLowerCase();
    return list.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.first_name.toLowerCase().includes(q) ||
        u.last_name.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  // ── Selection helpers ──────────────────────────────────────
  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const allSelected =
    filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length;

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!surveyId) {
      toast.error('لطفاً یک پرسشنامه انتخاب کنید');
      return;
    }
    if (selectedUserIds.size === 0) {
      toast.error('حداقل یک کاربر انتخاب کنید');
      return;
    }

    setSubmitting(true);
    try {
      const user_ids = Array.from(selectedUserIds);
      const payload = {
        survey: surveyId,
        user_ids,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        allow_resume: allowResume,
      };

      const result: BulkAssignResponse =
        await assignmentsApi.bulkCreate(payload);

      const created = result.created.length;
      const skipped = result.skipped.length;
      const missing = result.missing_users.length;

      if (created > 0) {
        toast.success(
          `${toFa(created)} تخصیص ساخته شد${
            skipped ? ` (${toFa(skipped)} تکراری)` : ''
          }${missing ? ` (${toFa(missing)} کاربر نامعتبر)` : ''}`,
        );
      } else if (skipped > 0) {
        toast.warning(
          `همه‌ی کاربران از قبل به این پرسشنامه تخصیص داده شده بودند.`,
        );
      } else {
        toast.error('هیچ تخصیصی ساخته نشد.');
      }

      onCreated();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  const selectedSurvey = surveys?.find((s) => s.id === surveyId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تخصیص جدید"
      description="پرسشنامه را به یک یا چند کاربر تخصیص دهید"
      size="xl"
    >
      <div className="p-6 space-y-6">
        {/* ═══════════════ Survey select ═══════════════ */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            پرسشنامه <span className="text-destructive">*</span>
          </label>
          {loadingSurveys ? (
            <div className="h-10 bg-muted rounded-xl animate-pulse" />
          ) : !surveys || surveys.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={16}
                  className="text-amber-600 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    پرسشنامه منتشرشده‌ای وجود ندارد
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ابتدا یک پرسشنامه بسازید و منتشر کنید.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {surveys.map((s) => {
                const selected = s.id === surveyId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSurveyId(s.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/30',
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        selected
                          ? 'border-primary bg-primary'
                          : 'border-border',
                      )}
                    >
                      {selected && (
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {toFa(s.questions_count)} سوال ·{' '}
                        {s.category || 'بدون دسته'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════════════ Users select ═══════════════ */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold">
              کاربران <span className="text-destructive">*</span>
              {selectedUserIds.size > 0 && (
                <span className="text-xs text-muted-foreground mr-2 font-normal">
                  ({toFa(selectedUserIds.size)} انتخاب‌شده)
                </span>
              )}
            </label>
            {filteredUsers.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:underline font-medium"
              >
                {allSelected ? 'لغو انتخاب همه' : 'انتخاب همه'}
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="جستجوی کاربر بر اساس ایمیل یا نام..."
              className="pr-9"
            />
          </div>

          {/* User list */}
          {loadingUsers ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-muted rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground text-center">
              کاربری برای تخصیص وجود ندارد.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground text-center">
              کاربری مطابق جستجو یافت نشد.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {filteredUsers.map((u) => {
                const selected = selectedUserIds.has(u.id);
                const role = userRole(u);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-xl border text-right transition-all',
                      selected
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-card hover:bg-accent/50',
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        selected
                          ? 'border-primary bg-primary'
                          : 'border-border',
                      )}
                    >
                      {selected && (
                        <Check
                          size={12}
                          className="text-primary-foreground"
                        />
                      )}
                    </div>

                    {/* ═══ Avatar ═══ */}
                    <UserAvatar
                      user={{
                        avatar: u.avatar ?? null,
                        full_name: u.full_name,
                        email: u.email,
                        first_name: u.first_name,
                        last_name: u.last_name,
                      }}
                      size="sm"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {u.full_name || u.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>

                    {/* Role badge */}
                    <Badge
                      variant={
                        role === 'admin'
                          ? 'info'
                          : role === 'creator'
                          ? 'success'
                          : 'muted'
                      }
                      className="flex-shrink-0"
                    >
                      {role === 'admin'
                        ? 'مدیر'
                        : role === 'creator'
                        ? 'سازنده'
                        : 'کاربر'}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════════════ Options ═══════════════ */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              مهلت پاسخ (اختیاری)
            </label>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              اگر خالی بماند، بدون مهلت خواهد بود.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              اجازه ادامه
            </label>
            <button
              type="button"
              onClick={() => setAllowResume((v) => !v)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right',
                allowResume
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card',
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0',
                  allowResume ? 'border-primary bg-primary' : 'border-border',
                )}
              >
                {allowResume && (
                  <Check size={12} className="text-primary-foreground" />
                )}
              </div>
              <span className="text-sm">
                {allowResume
                  ? 'کاربر می‌تواند پاسخ را ذخیره و بعداً ادامه دهد'
                  : 'کاربر باید در یک نشست پاسخ دهد'}
              </span>
            </button>
          </div>
        </div>

        {/* ═══════════════ Selected summary ═══════════════ */}
        {selectedSurvey && selectedUserIds.size > 0 && (
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
            <p className="text-foreground">
              <span className="font-bold">
                {toFa(selectedUserIds.size)} کاربر
              </span>{' '}
              به پرسشنامه{' '}
              <span className="font-bold">«{selectedSurvey.title}»</span>{' '}
              تخصیص داده می‌شوند.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-muted/30">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          انصراف
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!surveyId || selectedUserIds.size === 0 || submitting}
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Users size={16} />
          )}
          تخصیص به{' '}
          {selectedUserIds.size > 0 ? toFa(selectedUserIds.size) : ''} کاربر
        </Button>
      </div>
    </Modal>
  );
}