// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkTabBar, type SkTab } from './SkTabBar';

afterEach(cleanup);

const tabs: SkTab[] = [
  { id: 'a', label: 'Alpha', icon: <svg /> },
  { id: 'b', label: 'Beta', icon: <svg />, dot: true, dotLabel: 'has items' },
];

describe('SkTabBar', () => {
  it('is a labelled nav with aria-current on the active tab', () => {
    render(<SkTabBar tabs={tabs} active="a" onSelect={() => {}} label="Sections" />);
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Alpha/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: /Beta/ }).getAttribute('aria-current')).toBeNull();
  });
  it('calls onSelect with the tab id', () => {
    const on = vi.fn();
    render(<SkTabBar tabs={tabs} active={null} onSelect={on} label="x" />);
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    expect(on).toHaveBeenCalledWith('b');
  });
  it('shows the dot with screen-reader text only on tabs that ask for it', () => {
    const { container } = render(<SkTabBar tabs={tabs} active="a" onSelect={() => {}} label="x" />);
    expect(container.querySelectorAll('.sk-tbr-dot')).toHaveLength(1);
    expect(screen.getByText('has items')).toBeTruthy();
  });
});
