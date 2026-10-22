import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import type { StatShareModel } from '../data/shareCard';

const drawStatCard = vi.fn(async () => undefined);
const cardBlob = vi.fn<(c: HTMLCanvasElement) => Promise<Blob | null>>();
vi.mock('../data/shareCard', () => ({
  drawStatCard: (...a: unknown[]) => (drawStatCard as (...x: unknown[]) => Promise<void>)(...a),
  cardBlob: (c: HTMLCanvasElement) => cardBlob(c),
}));

import { StatShareSheet } from './StatShareSheet';

const model: StatShareModel = {
  brand: 'Spotter',
  kicker: 'Standards',
  headline: 'Bench 100 kg',
  hero: { value: '100', label: 'kg' },
  rows: [],
  handle: '@me',
};

let desktop = false;
function stubMedia() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: desktop,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

let clicked: Array<{ href: string; download: string }> = [];
beforeEach(() => {
  setLocale('en');
  desktop = false;
  stubMedia();
  drawStatCard.mockClear();
  cardBlob.mockReset();
  cardBlob.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
  clicked = [];
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.href, download: this.download });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
});

const flush = () => act(async () => void (await Promise.resolve()));

describe('StatShareSheet', () => {
  it('shows the kicker, defaults to story on mobile and draws the card', () => {
    render(<StatShareSheet model={model} fileBase="bench" onClose={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Standards' })).toBeTruthy();
    expect(document.querySelector('.share-preview.story')).toBeTruthy();
    expect(drawStatCard).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), model, 'story');
  });

  it('defaults to square on desktop and offers Download instead of Share/Save', () => {
    desktop = true;
    stubMedia();
    render(<StatShareSheet model={model} fileBase="bench" onClose={() => undefined} />);
    expect(document.querySelector('.share-preview.square')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download image' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save image' })).toBeNull();
  });

  it('redraws when the format toggles', () => {
    render(<StatShareSheet model={model} fileBase="bench" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Square' }));
    expect(drawStatCard).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), model, 'square');
    expect(document.querySelector('.share-preview.square')).toBeTruthy();
  });

  it('downloads the PNG under the given file name (desktop)', async () => {
    desktop = true;
    stubMedia();
    render(<StatShareSheet model={model} fileBase="my-bench" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    await flush();
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'my-bench.png' }]);
  });

  it('shares natively when the platform can share files', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    render(<StatShareSheet model={model} fileBase="b" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await flush();
    expect(share).toHaveBeenCalledWith({
      files: [expect.objectContaining({ name: 'b.png', type: 'image/png' })],
      title: 'Bench 100 kg',
    });
    expect(clicked).toHaveLength(0);
  });

  it('falls back to a download when file sharing is unsupported', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() });
    render(<StatShareSheet model={model} fileBase="b" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await flush();
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'b.png' }]);
  });

  it('swallows a cancelled share and re-enables the buttons', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn(async () => {
        throw new DOMException('cancel', 'AbortError');
      }),
    });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    render(<StatShareSheet model={model} fileBase="b" onClose={() => undefined} />);
    const btn = screen.getByRole('button', { name: 'Share' }) as HTMLButtonElement;
    fireEvent.click(btn);
    await flush();
    expect(btn.disabled).toBe(false);
  });

  it('disables the actions while the image is being produced', async () => {
    let resolve: (b: Blob) => void = () => undefined;
    cardBlob.mockReturnValue(new Promise<Blob>((r) => (resolve = r)));
    render(<StatShareSheet model={model} fileBase="b" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    await flush();
    expect((screen.getByRole('button', { name: 'Save image' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Copy' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve(new Blob(['x'])));
    expect((screen.getByRole('button', { name: 'Save image' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('does nothing when the canvas yields no blob', async () => {
    cardBlob.mockResolvedValue(null);
    render(<StatShareSheet model={model} fileBase="b" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    await flush();
    expect(clicked).toHaveLength(0);
  });

  it('copies the image to the clipboard and flashes "Copied"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const write = vi.fn(async () => undefined);
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(public items: unknown) {}
      },
    );
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    try {
      render(<StatShareSheet model={model} fileBase="b" onClose={() => undefined} />);
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      await flush();
      expect(write).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('downloads instead when the clipboard cannot take images', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    render(<StatShareSheet model={model} fileBase="b" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await flush();
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'b.png' }]);
  });
});
