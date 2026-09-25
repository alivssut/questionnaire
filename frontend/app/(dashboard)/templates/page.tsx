'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

import { templatesApi } from '@/features/templates/api';
import type { Template } from '@/features/templates/types';
import { TemplateCard } from '@/features/templates/components/template-card';

import { Input } from '@/shared/components/ui/input';
import { Tabs } from '@/shared/components/ui/tabs';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RoleGuard } from '@/shared/components/guards/role-guard';
import { toFa } from '@/shared/lib/utils';

function TemplatesContent() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    templatesApi
      .list()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  const categories = useMemo(() => {
    const set = new Set((templates ?? []).map((t) => t.category));
    return ['ALL', ...Array.from(set)];
  }, [templates]);

  const filtered = useMemo(() => {
    const list = templates ?? [];
    return list.filter((t) => {
      const matchesCat = category === 'ALL' || t.category === category;
      const matchesSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [templates, category, search]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">قالب‌ها</h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          از قالب‌های آماده استفاده کنید یا آن‌ها را کپی و ویرایش کنید.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {categories.length > 1 && (
          <Tabs
            value={category}
            onValueChange={setCategory}
            items={categories.map((c) => ({
              value: c,
              label: c === 'ALL' ? 'همه' : c,
              count:
                c === 'ALL'
                  ? templates?.length
                  : templates?.filter((t) => t.category === c).length,
            }))}
          />
        )}

        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو..."
            className="pr-9"
          />
        </div>
      </div>

      {/* Content */}
      {!templates ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="قالبی یافت نشد"
          description="وقتی پرسشنامه‌ای منتشر کنید، به‌عنوان قالب اینجا نمایش داده می‌شود."
        />
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {toFa(filtered.length)} قالب
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <RoleGuard roles={['admin', 'creator']}>
      <TemplatesContent />
    </RoleGuard>
  );
}