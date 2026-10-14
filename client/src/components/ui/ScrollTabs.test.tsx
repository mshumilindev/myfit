import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScrollTabs, tabIds } from './ScrollTabs';

afterEach(cleanup);
const TABS = ['overview', 'workouts', 'strength'].map((id) => ({
  id,
  label: id[0].toUpperCase() + id.slice(1),
}));

function Harness() {
  const [v, setV] = useState('overview');
  return <ScrollTabs tabs={TABS} value={v} onChange={setV} label="Client sections" idBase="t" />;
}

describe('ScrollTabs', () => {
  it('is a tablist with one selected tab and roving tabindex', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Client sections' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[0].getAttribute('aria-controls')).toBe(tabIds('t', 'overview').panel);
  });

  it('arrow keys, Home and End move and wrap', () => {
    render(<Harness />);
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Workouts' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(list, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Strength' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Strength' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(list, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('click selects', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Strength' }));
    expect(screen.getByRole('tab', { name: 'Strength' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('marks overflow edges when the row scrolls', () => {
    const { container } = render(<Harness />);
    const list = container.querySelector('.stab-list') as HTMLElement;
    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 600 });
    Object.defineProperty(list, 'clientWidth', { configurable: true, value: 300 });
    list.scrollLeft = 0;
    fireEvent.scroll(list);
    expect(container.querySelector('.stab')?.getAttribute('data-edge-end')).toBe('true');
    expect(container.querySelector('.stab')?.getAttribute('data-edge-start')).toBe('false');
    list.scrollLeft = 120;
    fireEvent.scroll(list);
    expect(container.querySelector('.stab')?.getAttribute('data-edge-start')).toBe('true');
  });
});
