import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

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

describe('UserAvatar: a face that is not lost (SPO-109)', () => {
  it('a copy of an older revision paints at once, offline included, and a failed refresh keeps it', async () => {
    const store = await import('../avatarStore');
    vi.mocked(store.readAvatarBlob).mockImplementation(async (_u: string, want = 0) =>
      want > 0 ? null : new Blob(['old'], { type: 'image/jpeg' }),
    );
    getBlob.mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<UserAvatar userId="c3" name="Ola K" hasPhoto rev={9} />);
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(screen.queryByText('OK')).toBeNull();
  });
  it('a download that fails once is tried again', async () => {
    vi.useFakeTimers();
    const store = await import('../avatarStore');
    vi.mocked(store.readAvatarBlob).mockResolvedValue(null);
    getBlob
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const { container } = render(<UserAvatar userId="c4" name="Ivo B" hasPhoto rev={2} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getBlob).toHaveBeenCalledTimes(2);
    expect(container.querySelector('img')).not.toBeNull();
    vi.useRealTimers();
  });
  it('a download that never succeeds logs no person id or path to the console (SPO-337)', async () => {
    vi.useFakeTimers();
    const store = await import('../avatarStore');
    vi.mocked(store.readAvatarBlob).mockResolvedValue(null);
    getBlob.mockRejectedValue(
      Object.assign(new Error("Object 'avatars/uid-secret-77/photo' does not exist."), {
        code: 'storage/object-not-found',
      }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<UserAvatar userId="uid-secret-77" name="Ivo B" hasPhoto rev={3} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('uid-secret-77');
    expect(JSON.stringify(warn.mock.calls)).toContain('storage/object-not-found');
    vi.useRealTimers();
  });
});
