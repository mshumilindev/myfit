import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TlEntryRow } from './TlEntryRow';

describe('TlEntryRow (Programs, add-on installed)', () => {
  afterEach(cleanup);

  it('is a store-kit card row with a still icon that opens the catalog', () => {
    const onOpen = vi.fn();
    const { container } = render(<TlEntryRow onOpen={onOpen} />);
    expect(container.querySelector('.sk-root .sk-card')).not.toBeNull();
    // Still icon: the animated frames are only for the banner and the item page.
    expect(container.querySelector('img')?.getAttribute('src')).not.toContain('-anim');
    fireEvent.click(screen.getByRole('button', { name: /Train like a pro/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
