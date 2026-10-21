import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ uid: 'uA' as string | null, thumb: vi.fn() }));
vi.mock('../api', () => ({ currentUid: () => h.uid }));
vi.mock('./avatarThumb', () => ({ fetchAvatarThumb: (u: string) => h.thumb(u) }));

import { refreshRememberedAvatar } from './refreshAvatar';
import { readRemembered } from './rememberedPeople';

const seed = (avatar?: string) =>
  localStorage.setItem(
    'spotter.accounts',
    JSON.stringify([
      { uid: 'uA', name: 'Anna', login: 'anna', avatar, appName: '[DEFAULT]', lastUsed: 1 },
    ]),
  );

beforeEach(() => {
  localStorage.clear();
  h.uid = 'uA';
  h.thumb.mockReset();
});
afterEach(() => localStorage.clear());

describe('refreshRememberedAvatar', () => {
  it('fills in the photo of a remembered person who has none', async () => {
    seed();
    h.thumb.mockResolvedValue('data:image/jpeg;base64,xx');
    await refreshRememberedAvatar();
    expect(readRemembered(localStorage)[0]?.avatar).toBe('data:image/jpeg;base64,xx');
  });
  it('leaves an existing photo alone and does not download again', async () => {
    seed('data:old');
    await refreshRememberedAvatar();
    expect(h.thumb).not.toHaveBeenCalled();
    expect(readRemembered(localStorage)[0]?.avatar).toBe('data:old');
  });
  it('does nothing for a person who is not remembered, or when signed out', async () => {
    seed();
    h.uid = 'uB';
    await refreshRememberedAvatar();
    h.uid = null;
    await refreshRememberedAvatar();
    expect(h.thumb).not.toHaveBeenCalled();
  });
  it('a failed download leaves the initials', async () => {
    seed();
    h.thumb.mockResolvedValue(undefined);
    await refreshRememberedAvatar();
    expect(readRemembered(localStorage)[0]?.avatar).toBeUndefined();
  });
});
