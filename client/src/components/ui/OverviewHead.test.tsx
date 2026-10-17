import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const navigateHash = vi.hoisted(() => vi.fn());
vi.mock('../../navigateHash', () => ({ navigateHash }));

import { OverviewHead } from './OverviewHead';

afterEach(() => {
  cleanup();
  navigateHash.mockClear();
});

describe('OverviewHead', () => {
  it('renders the title and the programs-top page head', () => {
    const { container } = render(<OverviewHead title="Goals" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Goals' })).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('programs-top');
    expect((container.firstChild as HTMLElement).className).toContain('uipagehead');
  });

  it('the back control is labelled Overview and goes to #/overview', () => {
    render(<OverviewHead title="Goals" />);
    const back = screen.getByRole('button', { name: 'Overview' });
    fireEvent.click(back);
    expect(navigateHash).toHaveBeenCalledWith('#/overview');
  });
});
