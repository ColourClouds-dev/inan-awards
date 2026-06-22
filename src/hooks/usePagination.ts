import { useState, useCallback, useMemo } from 'react';

export interface UsePaginationResult<T> {
  page: number;
  pageCount: number;
  paginated: T[];
  goTo: (n: number) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

export function usePagination<T>(items: T[], pageSize: number): UsePaginationResult<T> {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // Clamp page when items length changes (e.g. after filtering)
  const safePage = Math.min(page, pageCount);

  const paginated = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  const goTo = useCallback((n: number) => {
    setPage(Math.max(1, Math.min(n, pageCount)));
  }, [pageCount]);

  const next = useCallback(() => setPage(p => Math.min(p + 1, pageCount)), [pageCount]);
  const prev = useCallback(() => setPage(p => Math.max(p - 1, 1)), []);
  const reset = useCallback(() => setPage(1), []);

  return { page: safePage, pageCount, paginated, goTo, next, prev, reset };
}
