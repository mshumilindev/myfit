// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkTray } from './SkTray';

afterEach(cleanup);

describe('SkTray', () => {
  it('is a status region with the label and the action', () => {
    render(<SkTray label="3 selected" actionLabel="Review" onAction={() => {}} />);
    expect(screen.getByRole('status').textContent).toContain('3 selected');
    expect(screen.getByRole('button', { name: 'Review' }).className).toContain('sk-bt-inv');
  });
  it('fires onAction', () => {
    const on = vi.fn();
    render(<SkTray label="1" actionLabel="Go" onAction={on} />);
    fireEvent.click(screen.getByRole('button'));
    expect(on).toHaveBeenCalledTimes(1);
  });
});
