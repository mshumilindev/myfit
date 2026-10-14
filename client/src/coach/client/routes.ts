/**
 * Hash routes of the client-side trainer screens (all real-app overlays, no rail changes):
 *   #/invite/<token>   invite landing, share step, connected / expired (S-25 .. S-28)
 *   #/trainer          My trainer page
 *   #/trainer/chat     chat with my trainer (S-35)
 *   #/trainer/log      Who saw your data (S-31)
 * Privacy and sharing (S-29) stays the real Health page `#/health/privacy` with the trainer block on top.
 */
export type ClientRoute =
  { page: 'invite'; token: string } | { page: 'trainer' } | { page: 'chat' } | { page: 'log' };

export const CLIENT_HEADS = ['invite', 'trainer'] as const;

/** `route` is the hash path without `#/` and without the query: "trainer/chat". */
export function parseClientRoute(route: string): ClientRoute | null {
  const [head, a] = route.split('/');
  if (head === 'invite' && a && /^[A-Za-z0-9_-]{1,64}$/.test(a))
    return { page: 'invite', token: a };
  if (head === 'trainer') {
    if (!a) return { page: 'trainer' };
    if (a === 'chat') return { page: 'chat' };
    if (a === 'log') return { page: 'log' };
  }
  return null;
}

export const isClientHead = (head: string): boolean =>
  (CLIENT_HEADS as readonly string[]).includes(head);

export const clientHash = (r: ClientRoute): string =>
  r.page === 'invite'
    ? `#/invite/${r.token}`
    : r.page === 'trainer'
      ? '#/trainer'
      : r.page === 'chat'
        ? '#/trainer/chat'
        : '#/trainer/log';
