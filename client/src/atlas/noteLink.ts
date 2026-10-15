/** Deep link of an Atlas push to its chat message: `#/coach?note=<id>` (SPO-21). */
export const noteUrl = (id: string): string => `/#/coach?note=${encodeURIComponent(id)}`;

/** The note id a push links to, or null. */
export function noteFromHash(hash: string): string | null {
  const q = hash.split('?')[1];
  if (!q) return null;
  return new URLSearchParams(q).get('note');
}
