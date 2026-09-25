'use client';

import { useSystemLists } from '@/features/system-lists/hooks';
import { Select } from '@/shared/components/ui/select';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
}

export function SystemListSelect({ value, onChange }: Props) {
  const { systemLists, loading } = useSystemLists();

  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5">
        لیست آماده (اختیاری)
      </label>
      <p className="text-[10px] text-muted-foreground mb-2">
        به جای وارد کردن دستی گزینه‌ها، از یک لیست آماده استفاده کنید.
      </p>
      <Select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
      >
        <option value="">
          {loading ? 'در حال بارگذاری...' : '— بدون لیست آماده —'}
        </option>
        {systemLists.map((sl) => (
          <option key={sl.id} value={sl.id}>
            {sl.name} ({sl.items.length} آیتم)
          </option>
        ))}
      </Select>
    </div>
  );
}