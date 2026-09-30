import React from 'react';
import { downloadCsv, type CsvColumn } from '../../utils/csv';

const CsvIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18" />
  </svg>
);

/** Exports the given rows as a spreadsheet-friendly CSV. */
export function CsvButton<T>({ filename, columns, rows, label = 'Export CSV' }: { filename: string; columns: CsvColumn<T>[]; rows: T[] | undefined; label?: string }) {
  return (
    <button type="button" className="btn-secondary !py-1.5 text-xs" disabled={!rows || rows.length === 0} onClick={() => rows && downloadCsv(filename, columns, rows)}>
      <CsvIcon /> {label}
    </button>
  );
}
