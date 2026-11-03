import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallVideo } from './CallVideo';

let play: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  play.mockRestore();
});

const stream = {} as MediaStream;

describe('CallVideo', () => {
  it('binds the stream, plays it and lets go on unmount', () => {
    const { container, unmount } = render(<CallVideo stream={stream} label="Anna" />);
    const v = container.querySelector('video') as HTMLVideoElement;
    expect(v.srcObject).toBe(stream);
    expect(play).toHaveBeenCalledTimes(1);
    expect(v.getAttribute('aria-label')).toBe('Anna');
    expect(v.muted).toBe(false);
    expect(v.className).toBe('uicall-video');
    unmount();
    expect(v.srcObject).toBeNull();
  });

  it('your own preview is mirrored and muted', () => {
    const { container } = render(<CallVideo stream={stream} self />);
    const v = container.querySelector('video') as HTMLVideoElement;
    expect(v.muted).toBe(true);
    expect(v.className).toBe('uicall-video uicall-video--mirror');
  });

  it('without a stream nothing plays', () => {
    render(<CallVideo stream={null} />);
    expect(play).not.toHaveBeenCalled();
  });

  it('a refused play() is not an error', async () => {
    play.mockRejectedValue(new Error('NotAllowedError'));
    expect(() => render(<CallVideo stream={stream} />)).not.toThrow();
    await Promise.resolve();
  });
});
