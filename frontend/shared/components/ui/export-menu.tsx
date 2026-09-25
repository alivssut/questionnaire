'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, FileType } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/shared/lib/utils';

interface ExportMenuProps {
  onExportCSV: () => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  disabled?: boolean;
}

export function ExportMenu({
  onExportCSV,
  onExportExcel,
  onExportPDF,
  disabled,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen((v) => !v)} disabled={disabled}>
        <Download size={14} /> خروجی
      </Button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-popover border border-border rounded-xl shadow-lg py-1 z-50">
          <button
            onClick={() => {
              onExportCSV();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-right"
          >
            <FileText size={14} /> خروجی CSV
          </button>
          {onExportExcel && (
            <button
              onClick={() => {
                onExportExcel();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-right"
            >
              <FileSpreadsheet size={14} /> خروجی Excel
            </button>
          )}
          {onExportPDF && (
            <button
              onClick={() => {
                onExportPDF();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-right"
            >
              <FileType size={14} /> خروجی PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}