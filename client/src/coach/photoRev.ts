/**
 * Photo revisions of the coach's clients (server `avatarRev`), kept in memory so every `ClientAvatar` can pass the
 * right one to the shared Avatar without each screen threading it through. Filled wherever the coach world lands
 * (cache and network alike); a changed revision makes the Avatar refetch, an equal one serves the on-device copy.
 */
import type { CoachClient } from './domain/types';

const revs = new Map<string, number>();

export function rememberPhotoRevs(clients: readonly Pick<CoachClient, 'id' | 'photoRev'>[]): void {
  for (const c of clients) {
    if (c.photoRev !== undefined) revs.set(c.id, c.photoRev);
    else revs.delete(c.id);
  }
}

export const photoRevOf = (id: string | undefined): number => (id ? (revs.get(id) ?? 0) : 0);
