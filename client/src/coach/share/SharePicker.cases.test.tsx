import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shareEn as sh } from '../../i18n/coachShare.en';
import { setViewport } from '../testViewport';
import { buildShareSource, createFixturesShareSource } from './__fixtures__/fixtures';
import type { ShareSourcePort } from './port';
import { clearRecentShares, rememberShare } from './search';
import { lowerConsent } from './ShareStoryFrame';
import { SharePicker, type SharePickerProps } from './SharePicker';
import type { ShareRef, Viewer } from './types';

const TR: Viewer = { side: 'trainer', clientId: 'c1' };
const anchor = { current: null } as { current: HTMLElement | null };

beforeEach(() => {
  setViewport(1440);
  clearRecentShares();
  anchor.current = document.body;
});
afterEach(cleanup);

function mount(over: Partial<SharePickerProps> & { port?: ShareSourcePort } = {}) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  const onAsk = vi.fn();
  render(
    <SharePicker
      open
      onClose={onClose}
      anchorRef={anchor}
      viewer={TR}
      who="Oleh"
      onPick={onPick}
      onAsk={onAsk}
      port={createFixturesShareSource({ warm: true })}
      {...over}
    />,
  );
  return { onPick, onClose, onAsk };
}
const box = () => screen.findByRole('combobox', { name: sh.pickSearchAria });
const type = async (q: string) => fireEvent.change(await box(), { target: { value: q } });
const chip = (kind: string, count?: number) =>
  screen.getByRole('button', {
    name: count == null ? new RegExp(`^${kind}`) : sh.pickChipAria(kind, count),
  });

describe('SharePicker: opening', () => {
  it('renders nothing when closed', () => {
    mount({ open: false });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shows suggestions for this chat, then the rest by type with "Show all"', async () => {
    mount();
    expect(await screen.findByText(sh.pickSuggested)).toBeTruthy();
    expect(screen.getByText(sh.pickMoreHead)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Show all/ }).length).toBeGreaterThan(0);
  });

  it('a lift being discussed leads the suggestions', async () => {
    mount({ topic: { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip' } });
    const list = await screen.findByRole('listbox', { name: sh.pickSuggested });
    expect(within(list).getAllByRole('option')[0].getAttribute('aria-label')).toBe(
      `${sh.kind.exercise}: Barbell Bench Press - Medium Grip`,
    );
  });

  it('lists what is already in the conversation and what was recently shared, once each', async () => {
    rememberShare({ kind: 'gym', id: 'iron-yard' });
    const inChat: ShareRef[] = [{ kind: 'gym', id: 'fithub-pozniaky' }];
    mount({ inChat });
    expect(await screen.findByText(sh.pickInConversation)).toBeTruthy();
    expect(screen.getByText(sh.pickRecent)).toBeTruthy();
    expect(screen.getAllByRole('option', { name: /Iron Yard/ })).toHaveLength(1);
  });

  it('a workout that is only partly readable (sets shared as effects) still appears among the recent shares, with its title', async () => {
    const all = buildShareSource().clients.c1.workouts;
    const w = all.find((x) => x.title !== all[0].title)!; // not one the suggestions already lead with
    const effects = createFixturesShareSource({
      warm: true,
      patch: (src) => {
        const c = src.clients.c1;
        return {
          ...src,
          clients: { ...src.clients, c1: { ...c, consent: { ...c.consent, sets: 'effects' } } },
        };
      },
    });
    rememberShare({ kind: 'workout', id: w.id });
    mount({ port: effects });
    expect(await screen.findByText(sh.pickRecent)).toBeTruthy();
    expect(screen.getAllByRole('option', { name: new RegExp(w.title) }).length).toBeGreaterThan(0);
  });

  it('while loading it shows a skeleton; a failed load can be retried', async () => {
    let fail = true;
    const port = createFixturesShareSource({ failWith: () => fail });
    mount({ port });
    expect(await screen.findByText(sh.pickFailed)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: sh.pickRetry }));
    expect(await screen.findByText(sh.pickSuggested)).toBeTruthy();
  });

  it('a slow source shows the loading state first', async () => {
    mount({ port: createFixturesShareSource({ delayMs: 60_000 }) });
    expect(await screen.findByLabelText(sh.pickLoading)).toBeTruthy();
  });
});

describe('SharePicker: searching', () => {
  it('typing narrows to groups of three with the count; "Show all" expands one group', async () => {
    mount();
    await type('e');
    const grp = () => screen.getByRole('region', { name: sh.kindPlural.exercise });
    await screen.findByRole('region', { name: sh.kindPlural.exercise }, { timeout: 3000 });
    expect(within(grp()).getAllByRole('option')).toHaveLength(3);
    fireEvent.click(within(grp()).getByRole('button', { name: /^Show all/ }));
    await waitFor(() => expect(within(grp()).getAllByRole('option').length).toBeGreaterThan(3));
  });

  it('a type chip narrows to that type with a sort control; pressing it again goes back', async () => {
    mount();
    await screen.findByText(sh.pickSuggested);
    fireEvent.click(chip(sh.filter.exercise));
    const sort = await screen.findByRole('group', { name: sh.pickSortAria(sh.kindLower.exercise) });
    const byMuscle = within(sort).getByRole('button', { name: sh.sort.muscle });
    expect(
      within(sort).getByRole('button', { name: sh.sort.az }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(byMuscle);
    await waitFor(() => expect(byMuscle.getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(chip(sh.filter.exercise));
    expect(await screen.findByText(sh.pickSuggested)).toBeTruthy();
  });

  it('a date in the query is shown as a chip and can be cleared; only workouts and activities of that day are listed', async () => {
    mount();
    await type('yesterday');
    expect(
      await screen.findByText(sh.pickDateOn('2026-10-06'), undefined, { timeout: 3000 }),
    ).toBeTruthy();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
    for (const o of screen.getAllByRole('option'))
      expect(o.getAttribute('aria-label')).toMatch(
        new RegExp(`^(${sh.kind.workout}|${sh.kind.activity})`),
      );
    fireEvent.click(screen.getByRole('button', { name: sh.pickDateClear }));
    expect(((await box()) as HTMLInputElement).value).toBe('');
  });

  it('nothing found: says so, and with a type chosen offers to search all types', async () => {
    mount();
    await type('zzzzqqq');
    expect(
      await screen.findByText(sh.pickEmptyQuery('zzzzqqq'), undefined, { timeout: 3000 }),
    ).toBeTruthy();
    fireEvent.change(await box(), { target: { value: '' } });
    await screen.findByText(sh.pickSuggested, undefined, { timeout: 3000 });
    fireEvent.click(chip(sh.filter.exercise));
    await type('zzzzqqq');
    const all = await screen.findByRole('button', { name: sh.pickAllTypes }, { timeout: 3000 });
    expect(screen.getByText(sh.pickEmptyKind(sh.kindLower.exercise, 'zzzzqqq'))).toBeTruthy();
    fireEvent.click(all);
    expect(await screen.findByText(sh.pickEmptyQuery('zzzzqqq'))).toBeTruthy();
  });

  it('a muscle query lists matching rows', async () => {
    mount();
    await type('chest');
    expect(
      (await screen.findAllByRole('option', undefined, { timeout: 3000 })).length,
    ).toBeGreaterThan(0);
  });

  it('a gym that exists only on the coach device is listed as such and cannot be picked', async () => {
    const base = createFixturesShareSource({
      warm: true,
      patch: (s) => ({
        ...s,
        library: {
          ...s.library,
          gyms: [{ ...s.library.gyms[0], id: 'home', name: 'Home gym', shareable: false }],
        },
      }),
    });
    const { onPick } = mount({ port: base });
    await type('home');
    const row = await screen.findByRole('option', { name: /Home gym/ }, { timeout: 3000 });
    expect(within(row).getByText(sh.pickDeviceOnly)).toBeTruthy();
    fireEvent.click(row);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('SharePicker: picking', () => {
  it('a click passes the typed ref', async () => {
    const { onPick } = mount();
    await type('iron');
    const row = await screen.findByRole('option', { name: /Iron Yard/ }, { timeout: 3000 });
    fireEvent.click(row);
    expect(onPick).toHaveBeenCalledWith({ kind: 'gym', id: 'iron-yard' });
  });

  it('Enter on the field picks the active row; arrows wrap at the ends', async () => {
    const { onPick } = mount();
    const field = await box();
    fireEvent.change(field, { target: { value: 'iron' } });
    await screen.findByRole('option', { name: /Iron Yard/ }, { timeout: 3000 });
    fireEvent.keyDown(field, { key: 'Enter' }); // nothing active yet: nothing happens
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    const id = field.getAttribute('aria-activedescendant');
    expect(id).toBeTruthy();
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('other keys do nothing, and the arrows are ignored when there are no rows', async () => {
    mount();
    const field = await box();
    fireEvent.change(field, { target: { value: 'zzzzqqq' } });
    await screen.findByText(sh.pickEmptyQuery('zzzzqqq'), undefined, { timeout: 3000 });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field.getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(field, { key: 'a' });
  });

  it('Close calls onClose', async () => {
    const { onClose } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('SharePicker: what the client keeps private', () => {
  const lowered = () => createFixturesShareSource({ warm: true, patch: lowerConsent('sets') });

  it('a locked type is a chip with the lock and a way to ask; asking once disables the button', async () => {
    const { onAsk } = mount({ port: lowered() });
    await screen.findByText(sh.pickSuggested);
    fireEvent.click(screen.getByRole('button', { name: sh.pickChipLocked(sh.filter.results) }));
    expect(await screen.findByText(sh.pickLockedGroup(sh.kindPlural.results))).toBeTruthy();
    expect(screen.queryAllByRole('option').length).toBe(0); // no result of Oleh is listed
    const ask = screen.getByRole('button', { name: sh.pickAsk('Oleh') });
    fireEvent.click(ask);
    expect(onAsk).toHaveBeenCalledWith('results');
    const asked = await screen.findByRole('button', { name: sh.pickAskedShort });
    expect((asked as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(sh.pickAskedNote('Oleh', sh.catWords.sets), { exact: false }),
    ).toBeTruthy();
  });

  it('without an onAsk handler there is no ask button, only the explanation', async () => {
    mount({ port: lowered(), onAsk: undefined });
    await screen.findByText(sh.pickSuggested);
    fireEvent.click(screen.getByRole('button', { name: sh.pickChipLocked(sh.filter.results) }));
    expect(await screen.findByText(sh.pickLockedGroup(sh.kindPlural.results))).toBeTruthy();
    expect(screen.queryByRole('button', { name: sh.pickAsk('Oleh') })).toBeNull();
  });
});
