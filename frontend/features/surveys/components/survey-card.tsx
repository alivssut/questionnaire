'use client';

import Link from 'next/link';
import {
  Edit, Eye, Users, BarChart3, Lock, Globe, CheckCircle2,
} from 'lucide-react';
import type { Survey } from '../types';
import { SurveyStatusBadge } from './survey-status-badge';
import { Badge } from '@/shared/components/ui/badge';
import { useAuth } from '@/shared/providers/auth-provider';
import { toFa, formatDate } from '@/shared/lib/utils';

export function SurveyCard({ survey }: { survey: Survey }) {
  const { user } = useAuth();

  // Owner or superuser can edit/assign/see analytics
  const isOwner =
    !!user &&
    (user.is_admin ||
      user.email === survey.created_by_email);
  const canEdit =
    !!user &&
    (user.is_admin || user.permissions?.includes('can_create_survey'));

  // Whether the current user can answer this survey
  const canAnswer =
    survey.status === 'PUBLISHED' &&
    (survey.visibility === 'PUBLIC' ||
      // If it's assigned visibility, user needs an assignment — we don't know
      // from the card, so we show the button anyway and let the backend decide.
      true);

  const isPublic = survey.visibility === 'PUBLIC';
  const isAnonymous = survey.response_mode === 'ANONYMOUS';

  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-md hover:border-primary/30 transition-all group flex flex-col">
      {/* Header */}
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

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2rem]">
        {survey.description || 'بدون توضیحات'}
      </p>

      {/* Stats */}
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

      {/* Spacer to push actions to bottom */}
      <div className="flex-1" />

      {/* ── Actions ─────────────────────────────────────────── */}
      {canEdit ? (
        // Creator / Admin actions
        <div className="flex items-center gap-1 pt-3 border-t border-border">
          <Link
            href={`/builder/${survey.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            title="ویرایش"
          >
            <Edit size={12} /> ویرایش
          </Link>

          <Link
            href={`/answer/${survey.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            title="پیش‌نمایش"
          >
            <Eye size={12} /> پیش‌نمایش
          </Link>

          <Link
            href={`/assignments?survey=${survey.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            title="تخصیص"
          >
            <Users size={12} /> تخصیص
          </Link>

          <Link
            href={`/analytics?survey=${survey.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            title="تحلیل"
          >
            <BarChart3 size={12} /> تحلیل
          </Link>
        </div>
      ) : (
        // Regular user actions
        <div className="flex items-center gap-1 pt-3 border-t border-border">
          {canAnswer ? (
            <Link
              href={`/answer/${survey.id}`}
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
      )}
    </div>
  );
}