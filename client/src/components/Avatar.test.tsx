import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

// SPO-109: a client's photo comes from Storage only when the roster says there is one; otherwise (no photo, no app,
// a failed download) the initials stay, with no broken image.
const getBlob = vi.fn();
vi.mock('firebase/storage', () => ({
  getBlob: (...a: unknown[]) => getBlob(...a),
  ref: (_s: unknown, p: string) => p,
}));
vi.mock('../firebase', () => ({ storage: {} }));
vi.mock('../avatarStore', () => ({
  readAvatarBlob: vi.fn(async () => null),
  writeAvatarBlob: vi.fn(),
  deleteAvatarBlob: vi.fn(),
}));

import { UserAvatar } from './Avatar';

beforeEach(() => {
  getBlob.mockReset();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:photo', revokeObjectURL: () => {} }),
  );
});
afterEach(cleanup);

describe('UserAvatar (client photos in Coach)', () => {
  it('without a photo flag: initials, and Storage is never asked', () => {
    const { container } = render(<UserAvatar userId="c1" name="Kate Mazur" hasPhoto={false} />);
    expect(screen.getByText('KM')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    expect(getBlob).not.toHaveBeenCalled();
  });
  it('with the flag: initials first, then the photo from avatars/{uid}/photo', async () => {
    getBlob.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const { container } = render(<UserAvatar userId="c1" name="Kate Mazur" hasPhoto rev={5} />);
    expect(screen.getByText('KM')).toBeTruthy();
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(getBlob).toHaveBeenCalledWith('avatars/c1/photo');
  });
  it('a failed download keeps the initials (no broken image)', async () => {
    getBlob.mockRejectedValue(new Error('storage/unauthorized'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<UserAvatar userId="c2" name="Veda Witch" hasPhoto rev={1} />);
    await waitFor(() => expect(getBlob).toHaveBeenCalled());
    expect(screen.getByText('VW')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });
});
