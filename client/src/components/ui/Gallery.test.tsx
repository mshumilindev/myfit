import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Gallery } from './Gallery';

afterEach(cleanup);

// Gallery is a dev-only token gallery (#/uikit): smoke render + the close path only.
describe('Gallery (smoke)', () => {
  it('renders the screen shell and title', () => {
    const { container } = render(<Gallery onClose={() => undefined} />);
    expect(container.querySelector('.uik')).not.toBeNull();
    expect(screen.getByText('UI Kit')).toBeTruthy();
  });

  it('back button calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<Gallery onClose={onClose} />);
    const back = container.querySelector('.uik-top button') as HTMLElement;
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
