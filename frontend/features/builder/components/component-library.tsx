'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { componentGroups } from '../question-types';
import type { QuestionType } from '@/features/surveys/types';

export function ComponentLibrary({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (label: string) =>
    setCollapsed((c) => ({ ...c, [label]: !c[label] }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-4 border-b border-border">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          اجزای پرسشنامه
        </p>
      </div>
      <div className="p-3 space-y-1">
        {componentGroups.map((group) => (
          <div key={group.label}>
            <button
              onClick={() => toggle(group.label)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            >
              {group.label}
              {collapsed[group.label] ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>
            {!collapsed[group.label] && (
              <div className="grid grid-cols-2 gap-1 mb-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={`${group.label}-${item.type}-${item.label}`}
                      onClick={() => onAdd(item.type)}
                      className="flex items-center gap-2 px-2.5 py-2.5 text-xs font-medium text-muted-foreground bg-card hover:bg-primary/5 hover:text-primary rounded-xl border border-border hover:border-primary/30 transition-all text-right"
                    >
                      <Icon size={13} className="flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}