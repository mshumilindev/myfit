// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(cleanup);
import { SkSegmented } from './SkSegmented';

const O = [
  { value: 'a', label: 'One' },
  { value: 'b', label: 'Two' },
];
describe('SkSegmented', () => {
  it('is a labelled group with the selected option pressed', () => {
    render(<SkSegmented options={O} value="b" label="Kind" />);
    expect(screen.getByRole('group', { name: 'Kind' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Two' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'One' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Two' }).className).toContain('sk-on');
  });
  it('reports the chosen value', () => {
    const on = vi.fn();
    render(<SkSegmented options={O} value="a" label="Kind" onChange={on} />);
    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(on).toHaveBeenCalledWith('b');
  });
});
