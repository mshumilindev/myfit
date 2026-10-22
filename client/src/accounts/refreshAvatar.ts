import { currentUid } from '../api';
import { fetchAvatarThumb } from './avatarThumb';
import { readRemembered, setAvatar } from './rememberedPeople';

/**
 * The landing's lockers show a small photo kept on the device. It is first fetched right at the remembered sign-in, which can
 * miss (Storage not ready yet, offline) or be absent for people remembered before photos existed. A signed-in start fills it
 * in when the remembered person still has none; best effort, never blocks anything.
 */
export async function refreshRememberedAvatar(): Promise<void> {
  try {
    const uid = currentUid();
    if (!uid) return;
    const me = readRemembered(localStorage).find((p) => p.uid === uid);
    if (!me || me.avatar) return;
    const thumb = await fetchAvatarThumb(uid);
    if (thumb) setAvatar(localStorage, uid, thumb);
  } catch {
    /* the landing shows initials */
  }
}
