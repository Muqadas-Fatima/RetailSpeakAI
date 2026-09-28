"use client";
/**
 * Generic collection driver for every Owner Portal list screen.
 *
 * Owns search, filters, sorting and pagination as frontend state, then delegates
 * fetching to a repository function from `records.ts`. Because the query shape
 * mirrors API query params, wiring a real backend means changing the repository
 * only — never a screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CollectionFetcher, CollectionQuery, CollectionSort } from "./records";
import { subscribeOwnerState } from "./store";

export type UseCollectionOptions = {
  pageSize?: number;
  initialFilters?: Record<string, string>;
  initialSort?: CollectionSort | null;
  /** Search debounce in ms. */
  debounceMs?: number;
};

export type OwnerCollection<Row> = {
  rows: Row[];
  total: number;
  isLoading: boolean;
  /** True only while a background refresh runs over existing rows. */
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
  query: CollectionQuery;
  search: string;
  setSearch: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (field: string, value: string) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  sort: CollectionSort | undefined;
  setSort: (next: CollectionSort) => void;
};

export function useOwnerCollection<Row>(
  fetcher: CollectionFetcher<Row>,
  options: UseCollectionOptions = {},
): OwnerCollection<Row> {
  const { pageSize = 10, initialFilters = {}, initialSort = null, debounceMs = 250 } = options;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [sort, setSort] = useState<CollectionSort | null>(initialSort);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loadedOnce = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  // Any change to the result set resets pagination to the first page.
  useEffect(() => setPage(1), [debouncedSearch, filters, sort]);

  const filterSignature = JSON.stringify(filters);
  const sortSignature = sort ? `${sort.columnId}:${sort.direction}` : "";

  const query = useMemo<CollectionQuery>(
    () => ({ page, pageSize, search: debouncedSearch, filters, sort }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageSize, debouncedSearch, filterSignature, sortSignature],
  );

  useEffect(() => {
    let cancelled = false;
    if (loadedOnce.current) setRefreshing(true);
    else setLoading(true);
    setError(null);

    fetcher(query)
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setError(cause instanceof Error ? cause.message : "Request failed");
      })
      .finally(() => {
        if (cancelled) return;
        loadedOnce.current = true;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, nonce]);

  // Any mutation to the centralized owner state refreshes open lists, so
  // related modules (products/inventory, orders/riders, khata/suppliers) stay
  // in sync without screens knowing about each other.
  useEffect(() => subscribeOwnerState(() => setNonce((value) => value + 1)), []);

  const setFilter = useCallback((field: string, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setSearch("");
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (search.trim() ? 1 : 0);

  return {
    rows,
    total,
    isLoading,
    isRefreshing,
    error,
    refetch: () => setNonce((value) => value + 1),
    query,
    search,
    setSearch,
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    page,
    setPage,
    pageSize,
    sort: sort ?? undefined,
    setSort: (next: CollectionSort) => setSort(next),
  };
}

/** Convenience reader so screens never repeat `filters[x] ?? ""`. */
export function filterValue(filters: Record<string, string>, field: string): string {
  return filters[field] ?? "";
}
