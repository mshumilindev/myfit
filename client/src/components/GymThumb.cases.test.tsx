import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GymPhoto } from '../data/gymProviders';

/** SPO-340/341: a gym thumbnail shows its photo, or the local graphic: never a map tile, never a broken image. */

const h = vi.hoisted(() => ({
  geo: true,
  resolve: vi.fn<(...a: unknown[]) => Promise<GymPhoto | null>>(),
}));
vi.mock('../legal/useGeoSearch', () => ({ useGeoSearchOn: () => h.geo }));
vi.mock('../data/gymProviders', () => ({ resolvePhotoInfo: (...a: unknown[]) => h.resolve(...a) }));

import { GymThumb, NEUTRAL_GYM, resetGymThumbCacheForTests } from './GymThumb';
import { GymResultThumb } from './GymResultThumb';

const PHOTO: GymPhoto = {
  url: 'https://upload.wikimedia.org/t/gym.jpg',
  credit: {
    author: 'Jan K.',
    license: 'CC BY-SA 4.0',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Gym.jpg',
  },
};

beforeEach(() => {
  h.geo = true;
  h.resolve.mockReset();
  resetGymThumbCacheForTests();
});

describe('GymThumb', () => {
  it('shows the resolved photo, lazy, with a text alternative naming the gym', async () => {
    h.resolve.mockResolvedValue(PHOTO);
    const { container } = render(<GymThumb name="Zdrofit Mokotów" lat={52.19} lng={21} />);
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(PHOTO.url);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toContain('Zdrofit Mokotów');
    expect(container.querySelector('.gym-photo-credit')).toBeNull(); // credit only in heroes
  });

  it('a hero (credit) prints author and licence as a link to the image page', async () => {
    h.resolve.mockResolvedValue(PHOTO);
    const { container } = render(
      <GymThumb name="Zdrofit" lat={52.19} lng={21} size={320} credit />,
    );
    await waitFor(() => expect(container.querySelector('.gym-photo-credit')).not.toBeNull());
    const credit = container.querySelector('.gym-photo-credit')!;
    expect(credit.textContent).toContain('Jan K. · CC BY-SA 4.0');
    const a = credit.querySelector('a')!;
    expect(a.getAttribute('href')).toBe(PHOTO.credit!.pageUrl);
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('a photo with no credit data prints no credit line', async () => {
    h.resolve.mockResolvedValue({ url: 'https://x/p.jpg' });
    const { container } = render(<GymThumb name="G" lat={1} lng={2} credit />);
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(container.querySelector('.gym-photo-credit')).toBeNull();
  });

  it('no photo: the local graphic, no <img>, no map tile', async () => {
    h.resolve.mockResolvedValue(null);
    const { container } = render(<GymThumb name="No Photo Gym" lat={10} lng={20} />);
    await act(async () => undefined);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.house-graphic')).not.toBeNull();
  });

  it('the graphic and the photo take the same box: the slot is sized by the parent, so nothing jumps', async () => {
    h.resolve.mockResolvedValue(PHOTO);
    const { container } = render(<GymThumb name="Boxed" lat={1} lng={2} size={44} boxed />);
    const box = container.querySelector<HTMLElement>('.gymthumb')!;
    expect(box.style.width).toBe('44px');
    expect(box.querySelector('.house-graphic')).not.toBeNull();
    await waitFor(() => expect(box.querySelector('img')).not.toBeNull());
    expect(container.querySelector<HTMLElement>('.gymthumb')!.style.height).toBe('44px');
  });

  it('a photo that fails to load falls back to the graphic', async () => {
    h.resolve.mockResolvedValue(PHOTO);
    const { container } = render(<GymThumb name="Broken" lat={3} lng={4} />);
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    expect(container.querySelector('.house-graphic')).not.toBeNull();
  });

  it('a lookup that rejects leaves the graphic, silently', async () => {
    h.resolve.mockRejectedValue(new Error('offline'));
    const { container } = render(<GymThumb name="Offline" lat={5} lng={6} />);
    await act(async () => undefined);
    expect(container.querySelector('.house-graphic')).not.toBeNull();
  });

  it('without the gym-search consent: the graphic and no lookup at all', async () => {
    h.geo = false;
    const { container } = render(<GymThumb name="Private" lat={7} lng={8} />);
    await act(async () => undefined);
    expect(h.resolve).not.toHaveBeenCalled();
    expect(container.querySelector('img')).toBeNull();
  });

  it('a gym seen once is remembered for the session: the second thumb shows it at once, one lookup', async () => {
    h.resolve.mockResolvedValue(PHOTO);
    const first = render(<GymThumb name="Twice" lat={9} lng={9} />);
    await waitFor(() => expect(first.container.querySelector('img')).not.toBeNull());
    const second = render(<GymThumb name="Twice" lat={9} lng={9} />);
    expect(second.container.querySelector('img')?.getAttribute('src')).toBe(PHOTO.url);
    expect(h.resolve).toHaveBeenCalledTimes(1);
  });

  it('a gym not known yet (no name, no position) looks nothing up', async () => {
    const { container } = render(<GymThumb name="" lat={0} lng={0} />);
    await act(async () => undefined);
    expect(h.resolve).not.toHaveBeenCalled();
    expect(container.querySelector('.house-graphic')).not.toBeNull();
  });

  it('neutral mode ends on the bundled picture, which needs no network', async () => {
    h.resolve.mockResolvedValue(null);
    const { container } = render(<GymThumb name="N" lat={1} lng={2} neutral />);
    await act(async () => undefined);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(NEUTRAL_GYM);
  });

  it('a very long name does not break the alternative text', async () => {
    h.resolve.mockResolvedValue(PHOTO);
    const name = 'Fitness Club Mokotów Aleja Wilanowska '.repeat(6).trim();
    const { container } = render(<GymThumb name={name} lat={1} lng={2} />);
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(container.querySelector('img')!.getAttribute('alt')).toContain(name);
  });
});

describe('GymResultThumb', () => {
  it('shows the photo, or the graphic when there is none', () => {
    const a = render(<GymResultThumb photo="https://x/p.jpg" />);
    expect(a.container.querySelector('img')?.getAttribute('src')).toBe('https://x/p.jpg');
    const b = render(<GymResultThumb />);
    expect(b.container.querySelector('img')).toBeNull();
    expect(b.container.querySelector('.house-graphic')).not.toBeNull();
  });

  it('a photo that fails to load becomes the graphic', () => {
    const { container } = render(<GymResultThumb photo="https://x/broken.jpg" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.house-graphic')).not.toBeNull();
  });

  it('without consent a given photo url is never handed to an <img>', () => {
    h.geo = false;
    const { container } = render(<GymResultThumb photo="https://x/p.jpg" />);
    expect(container.querySelector('img')).toBeNull();
  });
});
