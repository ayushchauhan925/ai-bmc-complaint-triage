import React from 'react';
import { formatNumber } from './format';

export const PAGE_SIZES = [25, 50, 100];

/** 1 … 4 5 [6] 7 8 … 50 — always the first, last and a window around the current page. */
export function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push('…');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizes = PAGE_SIZES,
  noun = 'results',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  pageSizes?: number[];
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border px-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-500">
      <span aria-live="polite">
        {total === 0 ? `No ${noun}` : <>Showing <strong className="font-medium text-slate-700">{formatNumber(from)}–{formatNumber(to)}</strong> of <strong className="font-medium text-slate-700">{formatNumber(total)}</strong> {noun}</>}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {onPageSize && total > pageSizes[0] && (
          <label className="flex items-center gap-1.5">
            Rows
            <select aria-label="Rows per page" className="input !w-auto !py-1 text-xs" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
              {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <button type="button" className={`${btn} border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40`} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
            {pageWindow(page, pages).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} aria-hidden="true" className="px-1">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? 'page' : undefined}
                  className={`${btn} ${p === page ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  onClick={() => onPage(p)}
                >
                  {p}
                </button>
              )
            )}
            <button type="button" className={`${btn} border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40`} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
          </nav>
        )}
      </div>
    </div>
  );
}
