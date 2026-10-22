import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { saveQuiet, loadQuiet, DEFAULT_QUIET } from '../quietHours';
import { QuietHoursRows } from './QuietHoursRows';

beforeEach(() => {
  setLocale('en');
  localStorage.clear();
  saveQuiet(DEFAULT_QUIET);
});
afterEach(cleanup);

describe('QuietHoursRows', () => {
  it('on by default: the switch, the summary of the window and both time pickers', () => {
    render(<QuietHoursRows />);
    const sw = screen.getByRole('switch', { name: /./ }) as HTMLInputElement;
    expect(sw.checked).toBe(true);
    expect(document.querySelector('.qh-sub')?.textContent).toContain('22:00');
    expect(document.querySelector('.qh-sub')?.textContent).toContain('07:00');
    const selects = [...document.querySelectorAll('select')] as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    expect(selects[0].value).toBe(String(22 * 60));
    expect(selects[1].value).toBe(String(7 * 60));
    expect(selects[0].options).toHaveLength(48);
  });

  it('changing the from and to time is saved and the summary follows', () => {
    render(<QuietHoursRows />);
    const [from, to] = [...document.querySelectorAll('select')] as HTMLSelectElement[];
    fireEvent.change(from, { target: { value: String(23 * 60 + 30) } });
    fireEvent.change(to, { target: { value: String(6 * 60) } });
    expect(loadQuiet()).toEqual({ on: true, from: 23 * 60 + 30, to: 6 * 60 });
    expect(document.querySelector('.qh-sub')?.textContent).toContain('23:30');
    expect(document.querySelector('.qh-sub')?.textContent).toContain('06:00');
  });

  it('switching off hides the pickers and keeps the times; switching on brings them back', () => {
    render(<QuietHoursRows />);
    fireEvent.click(screen.getByRole('switch'));
    expect(loadQuiet().on).toBe(false);
    expect(loadQuiet().from).toBe(22 * 60);
    expect(document.querySelector('select')).toBeNull();
    fireEvent.click(screen.getByRole('switch'));
    expect(document.querySelectorAll('select')).toHaveLength(2);
  });
});
