import { useCallback, useEffect, useMemo, useState } from 'react';

/** Debounce a fast-changing value (search boxes) so the API is not hit on every keystroke. */
export function useDebouncedValue<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** localStorage-backed state. Storage can be blocked or throw, so every access is guarded. */
export function usePersistentState<T>(key: string | undefined, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (!key) return initial;
    try {
      const raw = window.localStorage.getItem(`table:${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      if (!key) return;
      try {
        window.localStorage.setItem(`table:${key}`, JSON.stringify(v));
      } catch {
        /* storage unavailable - the preference simply is not remembered */
      }
    },
    [key]
  );
  return [value, set];
}

export type SortState = { key: string; order: 'asc' | 'desc' } | null;

/**
 * Page/size/sort/search state for a server-paged table. Changing anything that alters the result set
 * returns to page 1 so users never land on a page that no longer exists.
 */
export function useTableQueryState(opts: { pageSize?: number; sort?: SortState } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(opts.pageSize ?? 25);
  const [sort, setSortRaw] = useState<SortState>(opts.sort ?? null);
  const setPageSize = useCallback((n: number) => { setPageSizeRaw(n); setPage(1); }, []);
  const setSort = useCallback((s: SortState) => { setSortRaw(s); setPage(1); }, []);
  const resetPage = useCallback(() => setPage(1), []);
  return { page, setPage, pageSize, setPageSize, sort, setSort, resetPage };
}

type Accessor<T> = (row: T) => string | number | boolean | null | undefined;

/**
 * Client-side sort + page slice for small, bounded lists the API returns whole (departments, officers).
 * Large operational tables (complaints, audit log) sort and page on the server instead.
 */
export function useClientTable<T>(rows: T[], accessors: Record<string, Accessor<T>>, opts: { pageSize?: number } = {}) {
  const [sort, setSortRaw] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(opts.pageSize ?? 25);

  const sorted = useMemo(() => {
    const get = sort ? accessors[sort.key] : undefined;
    if (!sort || !get) return rows;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1; // empty values always last
      if (y === null || y === undefined) return -1;
      if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y, undefined, { sensitivity: 'base', numeric: true }) * dir;
      return (Number(x) - Number(y)) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = useMemo(() => sorted.slice((safePage - 1) * pageSize, safePage * pageSize), [sorted, safePage, pageSize]);

  return {
    rows: pageRows,
    total: sorted.length,
    sort,
    setSort: (s: SortState) => { setSortRaw(s); setPage(1); },
    pagination: { page: safePage, pageSize, total: sorted.length, onPage: setPage, onPageSize: (n: number) => { setPageSizeRaw(n); setPage(1); } },
    resetPage: () => setPage(1),
  };
}
