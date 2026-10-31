import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsentChips, ConsentLevelPicker } from './ConsentControls';

afterEach(cleanup);

const LV = { off: 'Off', effects: 'Effects only', full: 'Full' } as const;

describe('ConsentChips', () => {
  it('draws the level word per row and a lock for off', () => {
    const { container } = render(
      <ConsentChips
        label="Shared categories"
        items={[
          {
            id: 'totals',
            label: 'Workout totals',
            level: 'full',
            levelLabel: 'Full',
            what: 'Sessions',
          },
          {
            id: 'body',
            label: 'Body weight',
            level: 'off',
            levelLabel: 'Not shared',
            what: 'Oleh has not shared this',
          },
        ]}
      />,
    );
    const list = screen.getByLabelText('Shared categories');
    expect(list.querySelectorAll('.uiinfo-row')).toHaveLength(2);
    expect(screen.getByText('Not shared')).toBeTruthy();
    expect(container.querySelectorAll('.cc-row--off')).toHaveLength(1);
  });
});

describe('ConsentLevelPicker', () => {
  it('offers Off / Effects only / Full per category and reports the change', () => {
    const onChange = vi.fn();
    render(
      <ConsentLevelPicker
        legend="What you would like the client to share"
        levelLabels={LV}
        rows={[
          { id: 'sets', label: 'Sets and weights', value: 'off' },
          { id: 'sleep', label: 'Sleep', value: 'effects' },
        ]}
        onChange={onChange}
      />,
    );
    const sets = screen.getByRole('group', { name: 'Sets and weights' });
    expect(
      within(sets)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Off', 'Effects only', 'Full']);
    fireEvent.click(within(sets).getByRole('button', { name: 'Full' }));
    expect(onChange).toHaveBeenCalledWith('sets', 'full');
    expect(
      within(screen.getByRole('group', { name: 'Sleep' }))
        .getByRole('button', { name: 'Effects only' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('disabled fieldset blocks changes', () => {
    const onChange = vi.fn();
    render(
      <ConsentLevelPicker
        legend="L"
        levelLabels={LV}
        rows={[{ id: 'a', label: 'A', value: 'off' }]}
        onChange={onChange}
        disabled
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Full' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ConsentLevelPicker row options (SPO-99)', () => {
  it('highlights an asked row, hides a level the row lacks, blocks a row', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ConsentLevelPicker
        legend="L"
        levelLabels={LV}
        rows={[
          { id: 'a', label: 'Alcohol', value: 'off', highlight: true, levels: ['off', 'effects'] },
          { id: 'b', label: 'Nutrition', value: 'off', blocked: true },
          { id: 'c', label: 'Sleep', value: 'off' },
        ]}
        onChange={onChange}
      />,
    );
    expect(container.querySelectorAll('.cc-pick-row--ask')).toHaveLength(1);
    const a = screen.getByRole('group', { name: 'Alcohol' });
    expect(
      within(a)
        .getAllByRole('button')
        .map((x) => x.textContent),
    ).toEqual(['Off', 'Effects only']);
    const b = screen.getByRole('group', { name: 'Nutrition' });
    fireEvent.click(within(b).getByRole('button', { name: 'Full' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Sleep' })).getByRole('button', { name: 'Full' }),
    );
    expect(onChange).toHaveBeenCalledWith('c', 'full');
  });
});
