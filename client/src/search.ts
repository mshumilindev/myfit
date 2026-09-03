/**
 * Order-independent text search used across the app's search boxes.
 *
 * Every whitespace-separated token in `query` must appear somewhere in `hay`
 * (case-insensitive substring), in any order — so "bench barbell" matches
 * "Barbell Bench Press". An empty query matches everything.
 */
export function tokenMatch(hay: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const h = hay.toLowerCase();
  return q.split(/\s+/).every((tok) => h.includes(tok));
}
