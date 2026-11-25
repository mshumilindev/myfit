import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CatalogCard } from './CatalogCard';

afterEach(cleanup);

const base = {
  who: 'Bill Starr',
  title: 'Three-day 5×5 strength base',
  meta: '3 days · 12 weeks · ~60 min · Beginner',
};

describe('CatalogCard', () => {
  it('is one button named by author and title, with the facts line', () => {
    render(<CatalogCard {...base} />);
    const btn = screen.getByRole('button', { name: 'Bill Starr. Three-day 5×5 strength base' });
    expect(btn.textContent).toContain('3 days · 12 weeks');
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<CatalogCard {...base} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is not locked and has no tag by default', () => {
    const { container } = render(<CatalogCard {...base} />);
    expect(container.querySelector('.uicc--locked')).toBeNull();
    expect(container.querySelector('.uicc-tags')).toBeNull();
  });

  it('shows the Needs tag and dims when locked, and stays clickable', () => {
    const onClick = vi.fn();
    const { container } = render(
      <CatalogCard {...base} lockedLabel="Needs Advanced training" onClick={onClick} />,
    );
    expect(container.querySelector('.uicc--locked')).not.toBeNull();
    expect(screen.getByText('Needs Advanced training')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks the selected card', () => {
    const { container } = render(<CatalogCard {...base} selected />);
    expect(container.firstElementChild?.className).toMatch(/selected/);
  });
});
