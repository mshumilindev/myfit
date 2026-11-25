import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CycleStrip } from './CycleStrip';

const weeks = [1, 2, 3, 4].map((n) => ({
  n,
  title: `Week ${n}`,
  tag: n === 4 ? 'Deload' : 'Base',
}));
function Host() {
  const [v, setV] = useState(1);
  return <CycleStrip label="Cycle weeks" weeks={weeks} value={v} onPick={setV} />;
}
afterEach(cleanup);

describe('CycleStrip keyboard', () => {
  it('only the selected week is a tab stop; the tag is text, not just colour', () => {
    render(<Host />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    expect(screen.getByText('Deload')).toBeTruthy();
  });
  it('arrows, Home and End move the selection and the focus', () => {
    render(<Host />);
    const tab = (n: number) => screen.getByRole('tab', { name: new RegExp(`Week ${n}`) });
    fireEvent.keyDown(tab(1), { key: 'ArrowRight' });
    expect(tab(2).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(2));
    fireEvent.keyDown(tab(2), { key: 'End' });
    expect(tab(4).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(4), { key: 'ArrowRight' }); // stays on the last
    expect(tab(4).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(4), { key: 'Home' });
    expect(tab(1).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(1), { key: 'ArrowLeft' });
    expect(tab(1).getAttribute('aria-selected')).toBe('true');
  });
});
