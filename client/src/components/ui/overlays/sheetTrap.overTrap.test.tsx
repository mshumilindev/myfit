import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sheet } from '../Overlays';

describe('blocking sheet trap vs a consent prompt mounted in the same commit', () => {
  it('leaves the prompt usable (not inert) while the page behind the blocking sheet is inert', () => {
    const { unmount } = render(
      <>
        <Sheet onClose={() => undefined} dismissible={false} label="gate">
          <button>gate</button>
        </Sheet>
        <Sheet onClose={() => undefined} label="prompt" overTrap>
          <button>prompt</button>
        </Sheet>
      </>,
    );
    const layers = Array.from(document.body.querySelectorAll('.portal-layer'));
    const prompt = layers.find((l) => l.querySelector('[data-over-trap]'));
    expect(prompt).toBeTruthy();
    expect(prompt!.hasAttribute('inert')).toBe(false);
    unmount();
  });
});
