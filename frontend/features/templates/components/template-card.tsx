'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FileText, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { templatesApi } from '../api';
import { getErrorMessage } from '@/shared/lib/api/client';
import { toFa, cn } from '@/shared/lib/utils';
import type { Template } from '../types';

const COLOR_PALETTE = [
  'bg-indigo-500/10 text-indigo-600',
  'bg-violet-500/10 text-violet-600',
  'bg-emerald-500/10 text-emerald-600',
  'bg-amber-500/10 text-amber-600',
  'bg-blue-500/10 text-blue-600',
  'bg-pink-500/10 text-pink-600',
];

function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length];
}

export function TemplateCard({ template }: { template: Template }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const color = pickColor(template.id);

  const handleUse = async () => {
    setLoading(true);
    try {
      const newId = await templatesApi.useTemplate(template.id);
      toast.success('قالب کپی شد. اکنون می‌توانید ویرایشش کنید.');
      router.push(`/builder/${newId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md hover:border-primary/30 transition-all group flex flex-col">
      {/* Cover */}
      <div className={cn('h-24 flex items-center justify-center', color.split(' ')[0])}>
        <div className={cn('text-3xl font-black opacity-40 tracking-tight', color.split(' ')[1])}>
          {template.title
            .split(' ')
            .slice(0, 3)
            .map((w) => w[0])
            .join('')}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          {template.category}
        </span>
        <h3 className="text-sm font-bold mb-2 line-clamp-2">{template.title}</h3>
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2rem]">
          {template.description || 'بدون توضیحات'}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <FileText size={11} /> {toFa(template.questions_count)} سوال
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} /> {toFa(template.estimated_time_minutes)} دقیقه
          </span>
        </div>

        <div className="flex-1" />

        <Button onClick={handleUse} disabled={loading} className="w-full" size="md">
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          استفاده از قالب
        </Button>
      </div>
    </div>
  );
}