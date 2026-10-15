import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { Sheet } from './Overlays';

afterEach(cleanup);

// A drawer with a search field whose parent passes a fresh onClose on every render (typing re-renders it).
function SearchDrawer() {
  const [q, setQ] = useState('');
  return (
    <Sheet onClose={() => undefined}>
      <input aria-label="search" value={q} onChange={(e) => setQ(e.target.value)} />
    </Sheet>
  );
}

describe('Sheet focus', () => {
  it('keeps focus in a search field while typing (no blur on re-render)', () => {
    // The opener holds focus when the drawer mounts; closing/re-running the effect would hand focus back to it.
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    render(<SearchDrawer />);
    const input = document.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    for (const v of ['a', 'ab', 'abc']) {
      fireEvent.change(input, { target: { value: v } });
      expect(document.activeElement).toBe(input);
    }
    opener.remove();
  });
});
