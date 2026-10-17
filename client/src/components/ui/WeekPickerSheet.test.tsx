import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WeekPickerSheet, type WeekOption } from './WeekPickerSheet';

afterEach(cleanup);

const weeks: WeekOption[] = Array.from({ length: 7 }, (_, i) => ({
  label: `Week ${i}`,
  sub: `${i} sessions`,
  bars: [{ tone: 'accent', level: 2 }, { level: 1 }],
}));

describe('WeekPickerSheet', () => {
  it('is a dialog named by the title with an optional hint', () => {
    const { container, rerender } = render(
      <WeekPickerSheet
        title="Pick a week"
        hint="Newest first"
        weeks={weeks}
        selected={0}
        onPick={() => {}}
        onClose={() => {}}
        pageSize={3}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Pick a week' })).toBeTruthy();
    expect(container.ownerDocument.querySelector('.uiwps-title')?.textContent).toBe('Pick a week');
    expect(screen.getByText('Newest first')).toBeTruthy();
    rerender(
      <WeekPickerSheet
        title="Pick a week"
        weeks={weeks}
        selected={0}
        onPick={() => {}}
        onClose={() => {}}
        pageSize={3}
      />,
    );
    expect(document.querySelector('.uiwps-hint')).toBeNull();
  });

  it('shows one page of weeks with range, caption and WeekBars', () => {
    render(
      <WeekPickerSheet
        title="t"
        weeks={weeks}
        selected={0}
        onPick={() => {}}
        onClose={() => {}}
        pageSize={3}
      />,
    );
    expect(screen.getByText('Week 0')).toBeTruthy();
    expect(screen.getByText('2 sessions')).toBeTruthy();
    expect(screen.getByText('Week 2')).toBeTruthy();
    expect(screen.queryByText('Week 3')).toBeNull();
    expect(document.querySelectorAll('.uiwps .uiwb')).toHaveLength(3);
  });

  it('marks the selected week and picks by its absolute index', () => {
    const onPick = vi.fn();
    render(
      <WeekPickerSheet
        title="t"
        weeks={weeks}
        selected={1}
        onPick={onPick}
        onClose={() => {}}
        pageSize={3}
      />,
    );
    expect(screen.getByText('Week 1').closest('button')?.className).toContain('is-selected');
    expect(screen.getByText('Week 0').closest('button')?.className).not.toContain('is-selected');
    fireEvent.click(screen.getByText('Week 2'));
    expect(onPick).toHaveBeenCalledWith(2);
  });

  it('opens on the page that holds the selected week', () => {
    render(
      <WeekPickerSheet
        title="t"
        weeks={weeks}
        selected={4}
        onPick={() => {}}
        onClose={() => {}}
        pageSize={3}
      />,
    );
    expect(screen.getByText('Week 3')).toBeTruthy();
    expect(screen.queryByText('Week 0')).toBeNull();
  });

  it('pages with the pager and picks an index on the later page', () => {
    const onPick = vi.fn();
    render(
      <WeekPickerSheet
        title="t"
        weeks={weeks}
        selected={0}
        onPick={onPick}
        onClose={() => {}}
        pageSize={3}
      />,
    );
    const nav = document.querySelector('nav.uipager') as HTMLElement;
    expect(nav.textContent).toContain('1');
    expect(nav.textContent).toContain('3');
    const buttons = nav.querySelectorAll('button');
    fireEvent.click(buttons[1]);
    expect(screen.queryByText('Week 0')).toBeNull();
    fireEvent.click(screen.getByText('Week 4'));
    expect(onPick).toHaveBeenCalledWith(4);
  });

  it('has no pager when everything fits one page', () => {
    render(
      <WeekPickerSheet
        title="t"
        weeks={weeks.slice(0, 2)}
        selected={0}
        onPick={() => {}}
        onClose={() => {}}
        pageSize={3}
      />,
    );
    expect(document.querySelector('nav.uipager')).toBeNull();
  });
});
