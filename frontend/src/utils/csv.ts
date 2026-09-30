export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

// A cell starting with = + - @ (or tab/CR) is interpreted as a FORMULA by Excel/Sheets, so a
// citizen-supplied value like `=HYPERLINK(...)` could execute when staff open the export.
// Prefixing an apostrophe makes the spreadsheet treat it as plain text (OWASP CSV injection).
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(','));
  return [head, ...body].join('\r\n');
}

/** Downloads a CSV (UTF-8 with BOM so Excel shows Devanagari and accented text correctly). */
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const blob = new Blob([`﻿${toCsv(columns, rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
