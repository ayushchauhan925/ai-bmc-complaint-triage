import React, { useEffect, useMemo, useRef } from 'react';
import { Popover } from './Popover';
import { Pagination } from './Pagination';
import { usePersistentState } from './hooks';
import type { SortState } from './hooks';
import { formatNumber } from './format';

export interface Column<T> {
  id: string;
  header: string;
  /** Tooltip for headers whose short label is ambiguous. */
  hint?: string;
  cell: (row: T) => React.ReactNode;
  /** Server sort key. A column without one is not sortable. */
  sortKey?: string;
  /** Sort direction applied on the first click (dates and priorities usually want 'desc'). */
  firstSort?: 'asc' | 'desc';
  /** Tailwind width/min-width classes, e.g. "w-28". Unset columns share the remaining space. */
  width?: string;
  align?: 'left' | 'right' | 'center';
  /** Clamp long text to one line with an ellipsis (pair with `tooltip`). */
  truncate?: boolean;
  tooltip?: (row: T) => string | undefined;
  /** Hide this column below a breakpoint (responsive column prioritisation). */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Max width class for truncated text, e.g. "max-w-[12rem]" (default 18rem). */
  maxWidth?: string;
  defaultHidden?: boolean;
  /** Cannot be switched off from the Columns menu. */
  locked?: boolean;
}

type Key = string | number;
export type Density = 'comfortable' | 'compact';

const HIDE = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
} as const;
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

function SortIcon({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <svg width="10" height="12" viewBox="0 0 10 14" aria-hidden="true" className="shrink-0">
      <path d="M5 1 1.5 5.5h7z" fill={dir === 'asc' ? '#1d4ed8' : '#cbd5e1'} />
      <path d="M5 13 1.5 8.5h7z" fill={dir === 'desc' ? '#1d4ed8' : '#cbd5e1'} />
    </svg>
  );
}

export interface DataTableProps<T> {
  /** Names the table for assistive tech. */
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => Key;
  rowClassName?: (row: T) => string | undefined;

  // data state
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  errorTitle?: string;
  onRetry?: () => void;

  // empty states (the table tells "no data" from "nothing matches")
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  filtered?: boolean;
  filteredTitle?: string;
  onClearFilters?: () => void;

  // sorting (server-side: the parent re-queries)
  sort?: SortState;
  onSortChange?: (s: SortState) => void;

  // selection
  selection?: Map<Key, T>;
  onSelectionChange?: (next: Map<Key, T>) => void;
  /** Rendered in the selection bar, e.g. an Export-selected button. */
  bulkActions?: (selected: T[]) => React.ReactNode;

  // chrome
  toolbar?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  filterBar?: React.ReactNode;
  /** Persists column visibility and density for this table (localStorage, optional). */
  storageKey?: string;
  columnMenu?: boolean;
  densityToggle?: boolean;
  defaultDensity?: Density;
  /** Content shown instead of the table below `md` (card list). Without it the table scrolls horizontally. */
  mobileCard?: (row: T) => React.ReactNode;
  stickyHeader?: boolean;
  /** Drop the outer card border, for tables that already sit inside a card. */
  bare?: boolean;
  footer?: React.ReactNode;
  pagination?: { page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize?: (n: number) => void; noun?: string };
  /** Noun used in the summary line when there is no pagination, e.g. "departments". */
  summaryNoun?: string;
  className?: string;
}

/**
 * The one table for the whole product: sticky header, server sorting, selection, column visibility,
 * density, skeleton/empty/error states, responsive columns or mobile cards, and pagination.
 * Pages own the data (TanStack Query) and pass it in; the table never fetches.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const {
    caption, columns, rows, rowKey, rowClassName, isLoading, isFetching, error, errorTitle = 'Unable to load data', onRetry,
    emptyTitle = 'Nothing here yet', emptyDescription, emptyAction, filtered, filteredTitle = 'No results match your filters',
    onClearFilters, sort, onSortChange, selection, onSelectionChange, bulkActions, toolbar, toolbarActions, filterBar,
    storageKey, columnMenu, densityToggle, defaultDensity = 'comfortable', mobileCard, stickyHeader = true, bare, footer, pagination,
    summaryNoun, className = '',
  } = props;

  const [hidden, setHidden] = usePersistentState<string[]>(storageKey ? `${storageKey}:cols` : undefined, columns.filter((c) => c.defaultHidden).map((c) => c.id));
  const [density, setDensity] = usePersistentState<Density>(storageKey ? `${storageKey}:density` : undefined, defaultDensity);

  const visible = useMemo(() => columns.filter((c) => c.locked || !hidden.includes(c.id)), [columns, hidden]);
  const hasData = !!rows && rows.length > 0;
  const showError = !!error && !hasData;
  const showSkeleton = !!isLoading && !hasData && !showError;
  const selectable = !!selection && !!onSelectionChange;
  const colCount = visible.length + (selectable ? 1 : 0);

  const pageKeys = (rows ?? []).map(rowKey);
  const selectedOnPage = pageKeys.filter((k) => selection?.has(k)).length;
  const allOnPage = hasData && selectedOnPage === pageKeys.length;
  const headerCheck = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheck.current) headerCheck.current.indeterminate = selectedOnPage > 0 && !allOnPage;
  }, [selectedOnPage, allOnPage]);

  const toggleAllOnPage = () => {
    if (!selection || !onSelectionChange || !rows) return;
    const next = new Map(selection);
    if (allOnPage) rows.forEach((r) => next.delete(rowKey(r)));
    else rows.forEach((r) => next.set(rowKey(r), r));
    onSelectionChange(next);
  };
  const toggleRow = (r: T) => {
    if (!selection || !onSelectionChange) return;
    const next = new Map(selection);
    const k = rowKey(r);
    if (next.has(k)) next.delete(k);
    else next.set(k, r);
    onSelectionChange(next);
  };

  const cycleSort = (col: Column<T>) => {
    if (!col.sortKey || !onSortChange) return;
    const first = col.firstSort ?? 'asc';
    const second = first === 'asc' ? 'desc' : 'asc';
    if (!sort || sort.key !== col.sortKey) onSortChange({ key: col.sortKey, order: first });
    else if (sort.order === first) onSortChange({ key: col.sortKey, order: second });
    else onSortChange(null); // third click returns to the default order
  };

  const pad = density === 'compact' ? 'py-1.5' : 'py-2.5';
  const hasToolbar = toolbar || toolbarActions || columnMenu || densityToggle;

  const cellContent = (c: Column<T>, r: T) => {
    const content = c.cell(r);
    if (!c.truncate) return content;
    const tip = c.tooltip?.(r) ?? (typeof content === 'string' ? content : undefined);
    return <span className="block max-w-full truncate" title={tip}>{content}</span>;
  };

  return (
    <section className={className} aria-busy={!!isFetching || undefined}>
      {hasToolbar && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          <div className="flex flex-wrap items-center gap-2">
            {densityToggle && (
              <div role="group" aria-label="Row density" className="hidden overflow-hidden rounded-md border border-slate-200 text-xs sm:inline-flex">
                {(['comfortable', 'compact'] as Density[]).map((d) => (
                  <button key={d} type="button" aria-pressed={density === d} onClick={() => setDensity(d)} className={`px-2.5 py-1.5 capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${density === d ? 'bg-slate-100 font-medium text-slate-900' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>{d}</button>
                ))}
              </div>
            )}
            {columnMenu && (
              <Popover role="dialog" triggerLabel="Columns" trigger={<>Columns</>}>
                {() => (
                  <fieldset className="px-3 py-1">
                    <legend className="sr-only">Visible columns</legend>
                    {columns.map((c) => (
                      <label key={c.id} className={`flex items-center gap-2 py-1 text-sm ${c.locked ? 'text-slate-400' : 'text-slate-700'}`}>
                        <input
                          type="checkbox"
                          checked={c.locked || !hidden.includes(c.id)}
                          disabled={c.locked}
                          onChange={(e) => setHidden(e.target.checked ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
                        />
                        {c.header}
                      </label>
                    ))}
                  </fieldset>
                )}
              </Popover>
            )}
            {toolbarActions}
          </div>
        </div>
      )}
      {filterBar && <div className="mb-2 space-y-2">{filterBar}</div>}

      {selectable && selection!.size > 0 && (
        <div role="status" className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-900">
          <span className="font-medium">
            {formatNumber(selection!.size)} selected{selectedOnPage > 0 && selectedOnPage !== selection!.size ? ` (${selectedOnPage} on this page)` : selectedOnPage === selection!.size ? ' on this page' : ' on other pages'}
          </span>
          {bulkActions?.(Array.from(selection!.values()))}
          <button type="button" className="ml-auto font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => onSelectionChange!(new Map())}>Clear selection</button>
        </div>
      )}

      <div className={bare ? 'overflow-hidden' : 'card overflow-hidden'}>
        {isFetching && hasData && <div className="h-0.5 w-full animate-pulse bg-brand-500" aria-hidden="true" />}

        {showError ? (
          <div role="alert" className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-800">{errorTitle}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Something went wrong while loading this table. Check your connection and try again.</p>
            {onRetry && <button type="button" onClick={onRetry} className="btn-secondary mt-4 text-xs">Retry</button>}
          </div>
        ) : (
          <>
            {mobileCard && hasData && <ul className="divide-y divide-slate-100 md:hidden" aria-label={caption}>{rows!.map((r) => <li key={rowKey(r)}>{mobileCard(r)}</li>)}</ul>}
            <div
              className={`${mobileCard && hasData ? 'hidden md:block' : ''} overflow-x-auto ${stickyHeader ? 'max-h-[calc(100vh-14rem)] overflow-y-auto' : ''}`}
              tabIndex={0}
              role="region"
              aria-label={`${caption} (scrollable)`}
            >
              <table className={`data-table ${density === 'compact' ? 'data-table-dense' : ''}`}>
                <caption className="sr-only">{caption}</caption>
                <thead>
                  <tr>
                    {selectable && (
                      <th scope="col" className="w-9 !pr-0">
                        <input ref={headerCheck} type="checkbox" aria-label="Select all rows on this page" checked={allOnPage} onChange={toggleAllOnPage} disabled={!hasData} />
                      </th>
                    )}
                    {visible.map((c) => {
                      const active = sort && c.sortKey && sort.key === c.sortKey ? sort.order : null;
                      return (
                        <th
                          key={c.id}
                          scope="col"
                          title={c.hint}
                          aria-sort={c.sortKey ? (active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none') : undefined}
                          className={`${c.width ?? ''} ${ALIGN[c.align ?? 'left']} ${c.hideBelow ? HIDE[c.hideBelow] : ''} ${c.id === 'actions' ? 'col-sticky-r' : ''}`}
                        >
                          {c.sortKey && onSortChange ? (
                            <button
                              type="button"
                              onClick={() => cycleSort(c)}
                              className={`inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'text-slate-900' : ''}`}
                            >
                              {c.header}
                              <SortIcon dir={active} />
                            </button>
                          ) : (
                            c.header
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {showSkeleton &&
                    Array.from({ length: Math.min(pagination?.pageSize ?? 8, 10) }).map((_, i) => (
                      <tr key={`sk-${i}`} aria-hidden="true">
                        {Array.from({ length: colCount }).map((__, j) => (
                          <td key={j} className={`${visible[j - (selectable ? 1 : 0)]?.hideBelow ? HIDE[visible[j - (selectable ? 1 : 0)].hideBelow!] : ''} ${pad}`}>
                            <div className={`h-3 animate-pulse rounded bg-slate-200/70 ${j % 3 === 0 ? 'w-3/4' : j % 3 === 1 ? 'w-1/2' : 'w-2/3'}`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {hasData &&
                    rows!.map((r) => {
                      const k = rowKey(r);
                      const sel = !!selection?.has(k);
                      return (
                        <tr key={k} data-selected={sel || undefined} className={rowClassName?.(r)}>
                          {selectable && (
                            <td className="!pr-0">
                              <input type="checkbox" aria-label={`Select row ${k}`} checked={sel} onChange={() => toggleRow(r)} />
                            </td>
                          )}
                          {visible.map((c) => (
                            <td
                              key={c.id}
                              className={`${c.width ?? ''} ${ALIGN[c.align ?? 'left']} ${c.align === 'right' ? 'num' : ''} ${c.truncate ? (c.maxWidth ?? 'max-w-[18rem]') : ''} ${c.hideBelow ? HIDE[c.hideBelow] : ''} ${c.id === 'actions' ? 'col-sticky-r' : ''}`}
                            >
                              {cellContent(c, r)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {!showSkeleton && !hasData && (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-700">{filtered ? filteredTitle : emptyTitle}</p>
                {(filtered ? 'Try removing a filter or searching for something else.' : emptyDescription) && (
                  <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{filtered ? 'Try removing a filter or searching for something else.' : emptyDescription}</p>
                )}
                <div className="mt-4 flex justify-center gap-2">
                  {filtered && onClearFilters ? <button type="button" className="btn-secondary text-xs" onClick={onClearFilters}>Clear filters</button> : emptyAction}
                </div>
              </div>
            )}
          </>
        )}

        {pagination && !showError && (
          <Pagination {...pagination} noun={pagination.noun} />
        )}
        {!pagination && hasData && summaryNoun && (
          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500" aria-live="polite">
            {formatNumber(rows!.length)} {summaryNoun}
          </div>
        )}
        {footer}
      </div>
    </section>
  );
}
