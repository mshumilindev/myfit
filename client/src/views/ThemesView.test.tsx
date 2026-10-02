import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { captureToday, clearTodaySnapshot, todaySnapshot } from '../data/todaySnapshot';
import { ThemesView } from './ThemesView';

afterEach(() => {
  cleanup();
  clearTodaySnapshot();
});

describe('todaySnapshot', () => {
  it('copies the screen without ids so it cannot clash with the live one', () => {
    const el = document.createElement('div');
    el.className = 'screen today-page';
    el.id = 'live';
    el.innerHTML = '<span id="x">hi</span><script>1</script>';
    captureToday(el);
    const snap = todaySnapshot();
    expect(snap?.html).toContain('today-page');
    expect(snap?.html).not.toContain('id=');
    expect(snap?.html).not.toContain('<script');
    expect(snap?.width).toBeGreaterThanOrEqual(320);
  });

  it('ignores a missing element', () => {
    captureToday(null);
    expect(todaySnapshot()).toBeNull();
  });
});

describe('ThemesView', () => {
  it('shows the current theme as applied, with a neutral tile when nothing was captured', () => {
    const { container } = render(<ThemesView onClose={() => undefined} />);
    expect(screen.getByText('Brass Glass')).toBeTruthy();
    expect(screen.getByText('Current')).toBeTruthy();
    expect(screen.getByText('Applied').closest('button')?.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('.thm-pv-in')).toBeNull();
  });

  it('previews the captured Today as an inert picture', () => {
    const el = document.createElement('div');
    el.className = 'screen today-page';
    el.textContent = 'Today now';
    captureToday(el);
    const { container } = render(<ThemesView onClose={() => undefined} />);
    const pv = container.querySelector('.thm-pv-in');
    expect(pv?.getAttribute('aria-hidden')).toBe('true');
    expect(pv?.hasAttribute('inert')).toBe(true);
    expect(pv?.textContent).toContain('Today now');
  });
});
