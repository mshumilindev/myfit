// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkHeader } from './SkHeader';

afterEach(cleanup);

describe('SkHeader', () => {
  it('shows the title as h1 and the exit button after the avatar', () => {
    const onExit = vi.fn();
    render(
      <SkHeader
        title="Discover"
        avatar={<button type="button">AK</button>}
        onExit={onExit}
        exitLabel="Back to Spotter"
        exitIcon={<svg />}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Discover');
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).toBe('AK');
    expect(buttons[1].getAttribute('aria-label')).toBe('Back to Spotter');
    fireEvent.click(buttons[1]);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
  it('replaces the title with a back button', () => {
    const onBack = vi.fn();
    render(<SkHeader title="Hidden" onBack={onBack} backLabel="Back" />);
    expect(screen.queryByRole('heading')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
  it('omits the exit button without onExit', () => {
    render(<SkHeader title="x" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
