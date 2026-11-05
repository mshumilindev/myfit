// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(cleanup);
import { SkAvatar } from './SkAvatar';

describe('SkAvatar', () => {
  it('renders at most two initials and the size class', () => {
    const { container } = render(<SkAvatar initials="ABC" size={40} />);
    expect(screen.getByText('AB')).toBeTruthy();
    expect(container.firstElementChild!.className).toContain('sk-av-40');
  });
  it('is a button with a label when clickable', () => {
    const on = vi.fn();
    render(<SkAvatar initials="MS" label="Account" onClick={on} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(on).toHaveBeenCalledTimes(1);
  });
  it('is not a button without onClick; role img with label', () => {
    render(<SkAvatar initials="MS" label="Maks" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('img', { name: 'Maks' })).toBeTruthy();
  });
  it('uses the image when src is given', () => {
    const { container } = render(<SkAvatar initials="MS" src="x.png" />);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('x.png');
    expect(screen.queryByText('MS')).toBeNull();
  });
});
