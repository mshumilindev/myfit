import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChallengesView } from './ChallengesView';
import { __getStateForTests } from '../store';
import {
  challengeCatalog,
  giveUpChallenge,
  startChallenge,
  templateById,
  type ActiveChallenge,
} from '../challenges';
import { fmtChallengeDuration } from '../challenges';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import {
  DAY,
  emptyState,
  freezeClock,
  NOW,
  richState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

const started: string[] = [];
const begin = (id: string, target: number, days: number, at = NOW - 3 * DAY): ActiveChallenge => {
  const ac = startChallenge(id, target, days, at);
  started.push(ac.id);
  return ac;
};
const titleOf = (id: string, n?: number) => {
  const tm = templateById(id)!;
  return tm.title(en, n ?? tm.target);
};

beforeEach(() => {
  freezeClock();
  setLocale('en');
  setDesktop(false);
  localStorage.clear();
  seed(richState());
});
afterEach(() => {
  act(() => {
    for (const id of started.splice(0)) giveUpChallenge(id);
  });
  cleanup();
  vi.useRealTimers();
});

const view = () => render(<ChallengesView store={__getStateForTests()} />);

describe('ChallengesView: catalog', () => {
  it('lists the catalog 20 to a page with a pager and no active section', () => {
    const { container } = view();
    expect(screen.getByText(en.challengesTitle)).toBeTruthy();
    expect(screen.queryByText(en.chActive)).toBeNull();
    expect(container.querySelectorAll('.ch-cat-row').length).toBe(20);
    expect(challengeCatalog().length).toBeGreaterThan(20);
    const first = container.querySelector('.ch-cat-title')?.textContent;
    expect(first).toBe(challengeCatalog()[0].title(en, challengeCatalog()[0].target));
    // page 2 shows the remainder
    fireEvent.click(screen.getByRole('button', { name: /next|›|2/i }));
    expect(container.querySelectorAll('.ch-cat-row').length).toBe(
      Math.min(20, challengeCatalog().length - 20),
    );
  });

  it('search narrows the catalog by title or keyword and explains an empty result', () => {
    const { container } = view();
    const box = screen.getByPlaceholderText(en.chSearchPlaceholder);
    fireEvent.change(box, { target: { value: 'tonnage' } });
    const rows = [...container.querySelectorAll('.ch-cat-title')].map((e) => e.textContent);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(5);
    fireEvent.change(box, { target: { value: 'zzzxqv' } });
    expect(screen.getByText(en.chSearchEmpty)).toBeTruthy();
    expect(container.querySelectorAll('.ch-cat-row').length).toBe(0);
  });

  it('the filter sheet narrows to one category, shows it as a removable chip, and All clears it', async () => {
    const { container } = view();
    fireEvent.click(screen.getByRole('button', { name: en.libFiltersLabel }));
    fireEvent.click(screen.getByRole('button', { name: en.chCat.volume }));
    await waitFor(() => expect(container.querySelector('.ch-active-filter')).toBeTruthy());
    const rows = [...container.querySelectorAll('.ch-cat-sub')].map((e) => e.textContent);
    expect(rows.length).toBe(challengeCatalog().filter((c) => c.category === 'volume').length);
    expect(new Set(rows)).toEqual(new Set([en.chCat.volume]));
    fireEvent.click(
      within(container.querySelector('.ch-active-filter') as HTMLElement).getByRole('button'),
    );
    expect(container.querySelector('.ch-active-filter')).toBeNull();
    expect(container.querySelectorAll('.ch-cat-row').length).toBe(20);
  });

  it('the filter sheet All button and its back button both close it', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: en.libFiltersLabel }));
    fireEvent.click(screen.getByRole('button', { name: en.chFilterAll }));
    await waitFor(() => expect(screen.queryByText(en.chFilterAll)).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: en.libFiltersLabel }));
    fireEvent.click(screen.getAllByRole('button', { name: en.backAction })[0]);
    await waitFor(() => expect(screen.queryByText(en.chFilterAll)).toBeNull());
  });
});

describe('ChallengesView: start flow', () => {
  function openStart(id: string) {
    const out = view();
    const row = [...out.container.querySelectorAll('.ch-cat-row')].find(
      (r) => r.querySelector('.ch-cat-title')?.textContent === titleOf(id),
    ) as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: en.chStart }));
    return { ...out, row };
  }

  it('the start sheet explains the challenge and offers a stepper and durations', () => {
    openStart('sessions');
    const tm = templateById('sessions')!;
    expect(screen.getByText(tm.blurb(en))).toBeTruthy();
    expect(screen.getByText(`${en.chTarget} — ${en.chUnit.sessions}`)).toBeTruthy();
    expect(screen.getByText(en.chDuration)).toBeTruthy();
  });

  it('the stepper moves by the template step and stops at its bounds', () => {
    openStart('sessions');
    const minus = screen.getByRole('button', { name: '−' }) as HTMLButtonElement;
    const plus = screen.getByRole('button', { name: '+' }) as HTMLButtonElement;
    const val = () => document.querySelector('.ch-step-val')?.textContent;
    expect(val()).toBe('50');
    fireEvent.click(plus);
    expect(val()).toBe('55');
    for (let i = 0; i < 20; i++) fireEvent.click(minus);
    expect(val()).toBe('10');
    expect(minus.disabled).toBe(true);
    for (let i = 0; i < 500; i++) if (!plus.disabled) fireEvent.click(plus);
    expect(val()).toBe('2000');
    expect(plus.disabled).toBe(true);
  });

  it('starting records the chosen target and duration and opens the detail', () => {
    openStart('sessions');
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: fmtChallengeDuration(180, en) }));
    fireEvent.click(screen.getByRole('button', { name: en.chStartCta }));
    const ac = JSON.parse(localStorage.getItem('spotter.challenges') ?? '[]')[0] as ActiveChallenge;
    started.push(ac.id);
    expect(ac.templateId).toBe('sessions');
    expect(ac.target).toBe(55);
    expect(ac.endsAt - ac.startedAt).toBe(180 * DAY);
    // the detail sheet is open and the new challenge sits in the active list
    expect(document.querySelector('.ch-detail')).toBeTruthy();
    expect(document.querySelector('.ch-detail-title')?.textContent).toBe(titleOf('sessions', 55));
    expect(screen.getByText(en.chNActive(1))).toBeTruthy();
  });

  it('a started challenge shows a clock chip instead of a start button', () => {
    begin('sessions', 50, 90);
    const { container } = view();
    const row = [...container.querySelectorAll('.ch-cat-row')].find(
      (r) => r.querySelector('.ch-cat-title')?.textContent === titleOf('sessions'),
    ) as HTMLElement;
    expect(within(row).queryByRole('button', { name: en.chStart })).toBeNull();
    expect(within(row).getByRole('img', { name: en.chActive })).toBeTruthy();
  });

  it('Escape closes the start sheet without starting anything', async () => {
    openStart('sessions');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('button', { name: en.chStartCta })).toBeNull());
    expect(JSON.parse(localStorage.getItem('spotter.challenges') ?? '[]')).toHaveLength(0);
  });
});

describe('ChallengesView: active challenges', () => {
  it('shows progress, unit and days left on the card and opens the detail with the by-day strip', () => {
    const ac = begin('sessions', 50, 90);
    const { container } = view();
    expect(screen.getByText(en.chNActive(1))).toBeTruthy();
    const card = container.querySelector('.ch-active') as HTMLElement;
    expect(card.querySelector('.ch-active-title')?.textContent).toBe(titleOf('sessions', 50));
    expect(card.querySelector('.ch-active-sub')?.textContent).toContain(en.chDaysLeft(87));
    expect(card.querySelector('.ch-pct')?.textContent).toMatch(/^\d+%$/);
    fireEvent.click(card);
    const detail = document.querySelector('.ch-detail') as HTMLElement;
    expect(detail).toBeTruthy();
    expect(detail.textContent).toContain(
      en.chEndsOn(new Date(ac.endsAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })),
    );
    expect(detail.querySelector('.ch-pace')?.textContent).toMatch(/\/day to finish on time$/);
    expect(detail.querySelectorAll('.ch-day').length).toBeGreaterThan(0);
    // close via the back button
    fireEvent.click(within(detail).getByRole('button', { name: en.backAction }));
    expect(document.querySelector('.ch-detail')).toBeNull();
  });

  it('clicking the scrim closes the detail but clicking inside does not', () => {
    begin('sessions', 50, 90);
    const { container } = view();
    fireEvent.click(container.querySelector('.ch-active') as HTMLElement);
    fireEvent.click(document.querySelector('.ch-detail-body') as HTMLElement);
    expect(document.querySelector('.ch-detail')).toBeTruthy();
    fireEvent.click(document.querySelector('.ch-scrim') as HTMLElement);
    expect(document.querySelector('.ch-detail')).toBeNull();
  });

  it('reach goals (strength) say "any time" instead of a daily pace', () => {
    begin('strength:bench', 300, 90);
    const { container } = view();
    fireEvent.click(container.querySelector('.ch-active') as HTMLElement);
    expect(document.querySelector('.ch-pace')?.textContent).toBe(en.chReachPace);
  });

  it('give up asks first; cancel keeps the challenge, confirm removes it', () => {
    const ac = begin('sessions', 50, 90);
    const { container } = view();
    fireEvent.click(container.querySelector('.ch-active') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: en.chGiveUp }));
    expect(screen.getByText(en.chGiveUpConfirm)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(screen.queryByText(en.chGiveUpConfirm)).toBeNull();
    expect(JSON.parse(localStorage.getItem('spotter.challenges') ?? '[]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: en.chGiveUp }));
    const confirmBtns = screen.getAllByRole('button', { name: en.chGiveUp });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(JSON.parse(localStorage.getItem('spotter.challenges') ?? '[]')).toHaveLength(0);
    expect(document.querySelector('.ch-detail')).toBeNull();
    expect(container.querySelector('.ch-active')).toBeNull();
    started.splice(started.indexOf(ac.id), 1);
  });

  it('an expired, unfinished challenge reads "Time’s up" on its card and in the detail', () => {
    begin('sessions', 500, 7, NOW - 20 * DAY);
    const { container } = view();
    expect(container.querySelector('.ch-active-sub')?.textContent).toContain(en.chEnded);
    fireEvent.click(container.querySelector('.ch-active') as HTMLElement);
    expect(document.querySelector('.ch-detail-when')?.textContent).toBe(en.chEnded);
    expect(document.querySelector('.ch-pace')).toBeNull();
  });
});

describe('ChallengesView: completion', () => {
  it('a reached target is marked done, celebrated once, and its catalog row gets a check', () => {
    seed(richState());
    // the fixture has 30 finished sessions inside the window
    const ac = begin('sessions', 10, 90, NOW - 80 * DAY);
    const { container } = view();
    const sheet = document.querySelector('.ch-complete') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect(sheet.querySelector('.ch-complete-kick')?.textContent).toBe(en.chComplete);
    expect(sheet.querySelector('.ch-complete-title')?.textContent).toBe(titleOf('sessions', 10));
    expect(sheet.querySelector('.ch-complete-body')?.textContent).toContain('10 sessions');
    const stored = JSON.parse(
      localStorage.getItem('spotter.challenges') ?? '[]',
    )[0] as ActiveChallenge;
    expect(stored.status).toBe('done');
    expect(stored.completedAt).toBe(NOW);
    fireEvent.click(within(sheet).getByRole('button', { name: en.chDone }));
    expect(document.querySelector('.ch-complete')).toBeNull();
    expect(JSON.parse(localStorage.getItem('spotter.challenges') ?? '[]')[0].celebrated).toBe(true);
    const row = [...container.querySelectorAll('.ch-cat-row')].find(
      (r) => r.querySelector('.ch-cat-title')?.textContent === titleOf('sessions'),
    ) as HTMLElement;
    expect(within(row).getByRole('img', { name: en.chDone })).toBeTruthy();
    expect(ac.id).toBeTruthy();
  });

  it('on an empty account nothing completes', () => {
    seed(emptyState());
    begin('sessions', 10, 90, NOW - 5 * DAY);
    render(<ChallengesView store={emptyState()} />);
    expect(document.querySelector('.ch-complete')).toBeNull();
  });
});
