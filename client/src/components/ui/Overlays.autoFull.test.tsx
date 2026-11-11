import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Sheet } from './Overlays';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const overflow = (scroll: number, client: number) => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scroll);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(client);
};

describe('Sheet height follows content', () => {
  it('stays compact when the content fits', () => {
    overflow(400, 400);
    render(<Sheet onClose={() => undefined}>a</Sheet>);
    expect(document.querySelector('.sheet-full')).toBeNull();
  });
  it('opens full when the content does not fit', () => {
    overflow(900, 600);
    render(<Sheet onClose={() => undefined}>a</Sheet>);
    expect(document.querySelector('.sheet-full')).not.toBeNull();
  });
});

describe('Sheet height follows content, both ways', () => {
  it('goes compact again when the content shrinks', () => {
    overflow(900, 600);
    const { rerender } = render(<Sheet onClose={() => undefined}>a</Sheet>);
    expect(document.querySelector('.sheet-full')).not.toBeNull();
    overflow(300, 300);
    rerender(<Sheet onClose={() => undefined}>b</Sheet>);
    expect(document.querySelector('.sheet-full')).toBeNull();
  });
});
