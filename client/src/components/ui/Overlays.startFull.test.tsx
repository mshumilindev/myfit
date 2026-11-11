import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Sheet } from './Overlays';

afterEach(cleanup);

describe('Sheet startFull', () => {
  it('opens at full height only when asked', () => {
    render(<Sheet onClose={() => undefined}>a</Sheet>);
    expect(document.querySelector('.sheet-full')).toBeNull();
    cleanup();
    render(
      <Sheet onClose={() => undefined} startFull>
        a
      </Sheet>,
    );
    expect(document.querySelector('.sheet-full')).not.toBeNull();
  });
});
