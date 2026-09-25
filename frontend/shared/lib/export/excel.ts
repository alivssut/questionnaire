/**
 * Excel-style export.
 * Since `xlsx` isn't installed, we generate a UTF-8 CSV with a `.xls` extension.
 * Excel opens it natively and can be "Save as .xlsx" from there.
 * No external dependencies needed.
 */

export async function downloadExcel<T extends Record<string, unknown>>(
    rows: T[],
    columns: { key: keyof T; label: string }[],
    filename: string,
    _sheetName = 'Sheet1',
  ): Promise<void> {
    // Build a CSV with Excel-friendly BOM + UTF-8 encoding
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
  
    const header = columns.map((c) => escape(c.label)).join(',');
    const body = rows
      .map((row) => columns.map((c) => escape(row[c.key])).join(','))
      .join('\n');
  
    const csv = '\uFEFF' + header + '\n' + body;
  
    const blob = new Blob([csv], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
  
    // .xls extension → Excel opens it as a spreadsheet
    const base = filename.replace(/\.(csv|xlsx|xls)$/i, '');
    link.download = `${base}.xls`;
  
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }