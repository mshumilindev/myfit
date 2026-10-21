import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuiteLauncherRow } from './SuiteLauncherRow';

afterEach(cleanup);

describe('SuiteLauncherRow', () => {
  it('is a button row with the label and a chevron', () => {
    const { container } = render(<SuiteLauncherRow label="Apps" onOpen={() => {}} />);
    const btn = screen.getByRole('button', { name: /Apps/ });
    expect(btn.className).toContain('uirow');
    expect(container.querySelector('.uirow-chev')).not.toBeNull();
  });

  it('calls onOpen on click', () => {
    const onOpen = vi.fn();
    render(<SuiteLauncherRow label="Apps" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders a leading icon by default and with a custom icon name', () => {
    const { container, rerender } = render(<SuiteLauncherRow label="Apps" onOpen={() => {}} />);
    expect(screen.getByRole('button').className).toContain('has-icon');
    const before = container.innerHTML;
    rerender(<SuiteLauncherRow label="Apps" icon="house" onOpen={() => {}} />);
    expect(screen.getByRole('button').className).toContain('has-icon');
    expect(container.innerHTML).not.toBe(before);
  });

  it('shows a long label as given', () => {
    const long = 'Apps '.repeat(30).trim();
    render(<SuiteLauncherRow label={long} onOpen={() => {}} />);
    expect(screen.getByText(long)).toBeTruthy();
  });
});
