import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { AnatomyTurntable as Turntable, TurnCamera } from './AnatomyTurntable';

// The module caches decoded pictures by URL, so every test loads a fresh copy of it.
const load = async () => {
  vi.resetModules();
  return (await import('./AnatomyTurntable')).AnatomyTurntable as typeof Turntable;
};

// Fakes the browser canvas pipeline (2d context, Image decode, createImageBitmap) so the frame
// builder, the draw loop and the cleanup run for real in jsdom.

const camera: TurnCamera = { yaw: 0, y: 0.5, zoom: 1, n: 0 };

const requested: string[] = [];
const closed = vi.fn();
const drawn = vi.fn();
const bitmap = vi.fn(async () => ({ close: closed }) as unknown as ImageBitmap);

const ctx = {
  clearRect: vi.fn(),
  drawImage: drawn,
  fillRect: vi.fn(),
  imageSmoothingQuality: 'low',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  shadowBlur: 0,
  shadowColor: '',
  fillStyle: '',
};

class FakeImage {
  decoding = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(v: string) {
    requested.push(v);
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  requested.length = 0;
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('createImageBitmap', bitmap);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  closed.mockClear();
  drawn.mockClear();
  bitmap.mockClear();
});

describe('AnatomyTurntable frame pipeline (faked canvas)', () => {
  it('decodes the layer pictures, builds bitmaps and paints the visible canvas', async () => {
    const AnatomyTurntable = await load();
    render(<AnatomyTurntable label="Spine" camera={camera} />);
    await waitFor(() => expect(bitmap).toHaveBeenCalled());
    expect(requested.length).toBeGreaterThan(0);
    expect(requested.every((u) => /\.(png|webp|jpe?g|avif)(\?|$)/i.test(u))).toBe(true);
    await waitFor(() => expect(drawn).toHaveBeenCalled());
  });

  it('muscles base also requests the muscles layer; bones base does not', async () => {
    let AnatomyTurntable = await load();
    const { unmount } = render(<AnatomyTurntable label="x" camera={camera} />);
    await waitFor(() => expect(requested.length).toBeGreaterThan(0));
    expect(requested.some((u) => u.includes('muscles'))).toBe(false);
    unmount();
    requested.length = 0;
    AnatomyTurntable = await load();
    render(<AnatomyTurntable label="x" camera={camera} base="muscles" />);
    await waitFor(() => expect(requested.some((u) => u.includes('muscles'))).toBe(true));
  });

  it('closes every built bitmap on unmount', async () => {
    const AnatomyTurntable = await load();
    const { unmount } = render(<AnatomyTurntable label="x" camera={camera} />);
    await waitFor(() => expect(bitmap).toHaveBeenCalled());
    await waitFor(() => expect(drawn).toHaveBeenCalled());
    unmount();
    expect(closed).toHaveBeenCalled();
  });

  it('a frame whose picture fails to load is skipped without throwing', async () => {
    class BrokenImage extends FakeImage {
      override set src(v: string) {
        requested.push(v);
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', BrokenImage);
    const AnatomyTurntable = await load();
    render(<AnatomyTurntable label="x" camera={camera} base="muscles" />);
    await waitFor(() => expect(requested.length).toBeGreaterThan(0));
    expect(bitmap).not.toHaveBeenCalled();
  });
});
