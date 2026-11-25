import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { CatalogPage } from './CatalogPage';
import { CATALOG } from './catalog';
import { addonsPref } from '../addons/enabledSet';

describe('CatalogPage', () => {
  beforeEach(() => addonsPref.reset());
  afterEach(cleanup);

  it('lists the programs, opens one and goes back', () => {
    render(<CatalogPage onClose={() => {}} />);
    expect(screen.getAllByRole('button', { name: /\. / }).length).toBeGreaterThan(10);
    const first = CATALOG.find((e) => e.id === 'linear-5x5-ab')!;
    fireEvent.click(screen.getByRole('button', { name: `${first.who}. ${first.title}` }));
    expect(screen.getByRole('heading', { name: first.who })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByPlaceholderText('Search athletes, programs, exercises')).toBeTruthy();
  });

  it('search narrows the list and an empty result offers to clear', () => {
    render(<CatalogPage onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Search athletes, programs, exercises');
    fireEvent.change(input, { target: { value: 'zzzz-none' } });
    expect(screen.getByText('No programs found')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByText('No programs found')).toBeNull();
  });

  it('filter sheet: a filter shows as a removable chip and the foot counts programs', () => {
    render(<CatalogPage onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Beginner' }));
    const show = within(sheet).getByRole('button', { name: /^Show \d+ programs$/ });
    fireEvent.click(show);
    expect(screen.getByRole('group', { name: 'Active filters' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Beginner' }));
    expect(screen.queryByRole('group', { name: 'Active filters' })).toBeNull();
  });

  it('a program that needs a missing add-on is tagged and its detail offers Get, not Start', () => {
    addonsPref.set([]);
    render(<CatalogPage onClose={() => {}} />);
    const locked = CATALOG.find(
      (e) => e.needs.includes('periodization') && !e.needs.includes('supersets'),
    )!;
    fireEvent.click(screen.getByRole('button', { name: `${locked.who}. ${locked.title}` }));
    expect(screen.queryByRole('button', { name: 'Start this program' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Get / })).toBeTruthy();
  });

  it('a program that needs nothing starts through the callback; held programs disable Start', () => {
    const started: string[] = [];
    const { unmount } = render(
      <CatalogPage onClose={() => {}} onStart={(e) => started.push(e.id)} />,
    );
    const plain = CATALOG.find((e) => e.id === 'linear-5x5-ab')!;
    fireEvent.click(screen.getByRole('button', { name: `${plain.who}. ${plain.title}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Start this program' }));
    expect(started).toEqual(['linear-5x5-ab']);
    unmount();
    render(<CatalogPage onClose={() => {}} heldHint="Your trainer's program is active." />);
    fireEvent.click(screen.getByRole('button', { name: `${plain.who}. ${plain.title}` }));
    expect(
      (screen.getByRole('button', { name: 'Start this program' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText("Your trainer's program is active.")).toBeTruthy();
  });
});
