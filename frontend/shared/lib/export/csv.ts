/** Convert array of objects to a CSV string with BOM for Excel UTF-8 support. */
export function toCSV<T extends Record<string, unknown>>(
    rows: T[],
    columns: { key: keyof T; label: string }[],
  ): string {
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
  
    return '\uFEFF' + header + '\n' + body; // BOM for Excel
  }
  
  export function downloadCSV<T extends Record<string, unknown>>(
    rows: T[],
    columns: { key: keyof T; label: string }[],
    filename: string,
  ) {
    const csv = toCSV(rows, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }