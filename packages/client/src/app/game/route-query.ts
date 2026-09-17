// Reading a dev route's query (docs/rendering/budget.md §7, docs/architecture/encyclopedia.md §12.7). The bench
// route and the encyclopedia preview route both take numbers off the URL with the same rule — a value that is not
// a finite number falls back to the route's default rather than poisoning the run — so the rule lives here once.

/** `key`'s value as a finite number, or `fallback` when it is absent or not one. */
export function numberParameter(parameters: URLSearchParams, key: string, fallback: number): number {
  const value = parameters.get(key);
  const parsed = value === null ? Number.NaN : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** The same, refusing zero and negatives: a zoom, a park time or an open count is always positive. */
export function positiveParameter(parameters: URLSearchParams, key: string, fallback: number): number {
  const parsed = numberParameter(parameters, key, fallback);
  return parsed > 0 ? parsed : fallback;
}
