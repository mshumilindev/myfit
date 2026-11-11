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

describe('Sheet startFull', () => {
  it('stays compact when not asked, even if the content is long', () => {
    overflow(900, 600);
    render(<Sheet onClose={() => undefined}>a</Sheet>);
    expect(document.querySelector('.sheet-full')).toBeNull();
  });
  it('stays compact when the content fits', () => {
    overflow(400, 400);
    render(
      <Sheet onClose={() => undefined} startFull>
        a
      </Sheet>,
    );
    expect(document.querySelector('.sheet-full')).toBeNull();
  });
  it('opens full when the content does not fit', () => {
    overflow(900, 600);
    render(
      <Sheet onClose={() => undefined} startFull>
        a
      </Sheet>,
    );
    expect(document.querySelector('.sheet-full')).not.toBeNull();
  });
});
