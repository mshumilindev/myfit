import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HomeSetView, type HomeSetRoute } from './HomeSetView';
import { pruneHomeSetDrafts } from './homeSetDraft';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { EMPTY_HOME } from '../../homeSets';
import type { Overlay, Shell } from '../../App';
import { __getStateForTests, __replaceStateForTests, saveHomeSet } from '../../store';

type Cur = { screen: 'home-set' } & HomeSetRoute;

/** The overlay stack in miniature, started on any page of the screen. */
function Harness({ start }: { start: Cur }) {
  const [stack, setStack] = useState<Cur[]>([start]);
  useEffect(() => pruneHomeSetDrafts(stack), [stack]);
  const shell = {
    openOverlay: (o: Overlay) => setStack((s) => (o ? [...s, o as Cur] : [])),
    replaceOverlay: (o: Overlay) => setStack((s) => (o ? [...s.slice(0, -1), o as Cur] : [])),
  } as unknown as Shell;
  const cur = stack[stack.length - 1];
  if (!cur) return <p>closed</p>;
  return <HomeSetView shell={shell} {...cur} onClose={() => setStack((s) => s.slice(0, -1))} />;
}
const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
const home = () => __getStateForTests().home;

beforeEach(() => {
  setLocale('en');
  __replaceStateForTests({
    ...__getStateForTests(),
    home: EMPTY_HOME,
    workouts: [],
    activities: [],
    sleeps: [],
  });
});
afterEach(cleanup);

describe('Home set: the moves picker', () => {
  it('a muscle chip narrows the list, a second tap on it and the "All" chip both bring everything back', () => {
    render(<Harness start={{ screen: 'home-set', page: 'add' }} />);
    const rows = () => document.querySelectorAll('.uigl-rows .uirow').length;
    const before = rows();
    const chest = btn(new RegExp(`^${(en.muscleGroups as Record<string, string>).chest}$`));
    fireEvent.click(chest);
    const narrowed = rows();
    expect(narrowed).toBeLessThan(before);
    fireEvent.click(chest);
    expect(rows()).toBe(before);
    fireEvent.click(chest);
    expect(rows()).toBe(narrowed);
    fireEvent.click(btn(en.homeMuscleAll));
    expect(rows()).toBe(before);
  });

  it('ticking a move twice un-ticks it and the Add button follows the count', () => {
    render(<Harness start={{ screen: 'home-set', page: 'add' }} />);
    expect(btn(en.homeAddMove).disabled).toBe(true);
    fireEvent.click(screen.getByText('Plank'));
    fireEvent.click(screen.getByText('Pullups'));
    expect(btn(/^Add 2 to/)).toBeTruthy();
    fireEvent.click(screen.getByText('Plank'));
    expect(btn(/^Add 1 to/)).toBeTruthy();
    fireEvent.click(screen.getByText('Pullups'));
    expect(btn(en.homeAddMove).disabled).toBe(true);
  });
});

describe('Home set: a saved set', () => {
  it('a move can be lifted one place up, which counts as a change', () => {
    const s = saveHomeSet({ name: 'Morning', moves: ['Pullups', 'Pushups', 'Plank'] });
    render(<Harness start={{ screen: 'home-set', page: 'set', id: s!.id }} />);
    expect(btn('Save').disabled).toBe(true);
    const up = screen.getAllByLabelText(en.homeMoveUp);
    expect((up[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(up[2]);
    expect(btn('Save').disabled).toBe(false);
    const order = [...document.querySelectorAll('.uirow-l')]
      .map((n) => n.textContent)
      .filter((x) => ['Pullups', 'Pushups', 'Plank'].includes(x ?? ''));
    expect(order).toEqual(['Pullups', 'Plank', 'Pushups']);
    fireEvent.click(btn('Save'));
    expect(home().sets[0].moves).toEqual(['Pullups', 'Plank', 'Pushups']);
  });

  it('"Keep it" on the delete question leaves the set alone', () => {
    const s = saveHomeSet({ name: 'Morning', moves: ['Pullups'] });
    render(<Harness start={{ screen: 'home-set', page: 'set', id: s!.id }} />);
    fireEvent.click(btn(en.homeDeleteSet));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain(en.homeDeleteSetTitle('Morning'));
    fireEvent.click(within(dialog).getByRole('button', { name: en.cancel }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(home().sets).toHaveLength(1);
  });
});

describe("Home set: looking at one of Spotter's moves", () => {
  it('says which of your sets use it, or that none does yet', () => {
    render(<Harness start={{ screen: 'home-set', page: 'move', id: 'Plank' }} />);
    expect(screen.getByText(en.homeInYourSets)).toBeTruthy();
    expect(screen.getByText(en.homeNoneYet)).toBeTruthy();
    cleanup();
    saveHomeSet({ name: 'Morning', moves: ['Plank'] });
    saveHomeSet({ name: 'Evening', moves: ['Plank', 'Pullups'] });
    render(<Harness start={{ screen: 'home-set', page: 'move', id: 'Plank' }} />);
    expect(screen.getByText('Morning, Evening')).toBeTruthy();
  });
});
