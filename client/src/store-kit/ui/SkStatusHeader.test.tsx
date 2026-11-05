// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkStatusHeader, type SkStatus } from './SkStatusHeader';

afterEach(cleanup);

describe('SkStatusHeader', () => {
  it.each<SkStatus>(['ok', 'warn', 'bad', 'progress'])('maps status %s', (s) => {
    const { container } = render(<SkStatusHeader status={s} icon={<svg />} title="T" />);
    expect(container.firstElementChild?.className).toContain(`sk-sth-${s}`);
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(s);
  });
  it('has a level-1 heading and a decorative icon', () => {
    const { container } = render(<SkStatusHeader status="ok" icon={<svg />} title="All set" />);
    expect(screen.getByRole('heading', { level: 1, name: 'All set' })).toBeTruthy();
    expect(container.querySelector('.sk-sth-icon')?.getAttribute('aria-hidden')).toBe('true');
  });
  it('renders aside and a screen-reader status label', () => {
    render(<SkStatusHeader status="bad" icon={<svg />} statusLabel="Failed" aside={<i>AK</i>} />);
    expect(screen.getByText('AK')).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toContain('Failed');
  });
  it('omits the heading without title or label', () => {
    render(<SkStatusHeader status="ok" icon={<svg />} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
