"use client";
/**
 * Local query engine for the mock JSON datasets.
 *
 * It applies the same `CollectionQuery` envelope (search, filters, sort, paging)
 * that a real API would receive, so screens behave identically once each
 * repository body is swapped for a `fetch`. Nothing here is business data — the
 * rows come from `src/data/**.json`.
 */
import type { CollectionFetcher, CollectionPage, CollectionQuery } from "./records";

/** Simulated request latency so loading skeletons are exercised. */
const LATENCY = 280;

export function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

type Row = Record<string, unknown>;

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function matchesSearch(row: Row, search: string, fields: string[] | undefined): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const keys = fields && fields.length > 0 ? fields : Object.keys(row);
  return keys.some((key) => toText(row[key]).toLowerCase().includes(term));
}

function matchesFilters(row: Row, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    return toText(row[key]).toLowerCase() === value.toLowerCase();
  });
}

/** Numeric-aware comparison; falls back to locale string compare. */
function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const left = toText(a);
  const right = toText(b);
  const leftNumber = Number(left.replace(/[^\d.-]/g, ""));
  const rightNumber = Number(right.replace(/[^\d.-]/g, ""));
  const numeric =
    left !== "" && right !== "" && !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);
  if (numeric && /\d/.test(left) && /\d/.test(right)) return leftNumber - rightNumber;
  return left.localeCompare(right);
}

export type MockCollectionOptions = {
  /** Fields scanned by free-text search; defaults to every field. */
  searchFields?: string[];
};

/**
 * Builds a repository function backed by an in-memory dataset.
 *
 * Replace the call site with a real request when a backend exists, e.g.
 * `export const fetchOrders: CollectionFetcher<OwnerOrder> = (query) =>
 *    api.get("/owner/orders", { params: toParams(query) })`.
 */
export function mockCollection<T>(
  dataset: readonly T[],
  options: MockCollectionOptions = {},
): CollectionFetcher<T> {
  return (query: CollectionQuery) => delay(runQuery(dataset, query, options));
}

export function runQuery<T>(
  dataset: readonly T[],
  query: CollectionQuery,
  options: MockCollectionOptions = {},
): CollectionPage<T> {
  const rows = (dataset as readonly Row[]).filter(
    (row) => matchesSearch(row, query.search, options.searchFields) && matchesFilters(row, query.filters),
  );

  if (query.sort) {
    const { columnId, direction } = query.sort;
    rows.sort((a, b) => {
      const result = compare(a[columnId], b[columnId]);
      return direction === "desc" ? -result : result;
    });
  }

  const total = rows.length;
  const start = Math.max(0, (query.page - 1) * query.pageSize);
  const paged = rows.slice(start, start + query.pageSize) as unknown as T[];
  return { rows: paged, total };
}

/** Single-record read helper mirroring `GET /resource/:id`. */
export function mockRecord<T>(lookup: (id: string) => T | undefined): (id: string) => Promise<T | null> {
  return (id: string) => delay(lookup(id) ?? null);
}

/**
 * Mock mutation: resolves as if the backend accepted the change. Nothing is
 * persisted — swap for a real request to make it durable.
 */
export function mockMutation<Input>(): (input: Input) => Promise<{ ok: true }> {
  return () => delay({ ok: true as const }, 500);
}
