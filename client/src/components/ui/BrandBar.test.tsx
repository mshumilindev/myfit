import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrandBar } from './BrandBar';

describe('BrandBar app switcher', () => {
  afterEach(cleanup);

  it('without tone + icon the app name is the legacy text label', () => {
    render(<BrandBar app="Gym" appLabel="Switch app" onApp={() => undefined} />);
    const b = screen.getByRole('button', { name: 'Switch app' });
    expect(b.className).toContain('app-brand-app');
    expect(b.textContent).toBe('Gym');
  });

  it('with tone + icon it is a visible chip: tile, name, caret, in the app tone, one tap', () => {
    const onApp = vi.fn();
    render(<BrandBar app="Apex" appLabel="Switch app" onApp={onApp} tone="apex" icon="trophy" />);
    const b = screen.getByRole('button', { name: 'Switch app' });
    expect(b.className).toContain('uibrand-chip');
    expect(b.classList.contains('uit--apex')).toBe(true);
    expect(b.getAttribute('aria-haspopup')).toBe('dialog');
    expect(b.querySelector('.uitile')).not.toBeNull();
    expect(b.querySelector('.uibrand-chip-name')?.textContent).toBe('Apex');
    expect(b.querySelector('.uibrand-chip-caret')).not.toBeNull();
    fireEvent.click(b);
    expect(onApp).toHaveBeenCalledTimes(1);
  });
});
