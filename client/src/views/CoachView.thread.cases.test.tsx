import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { coach, coachState, openThread, resetCoachMocks } from './__fixtures__/coachMocks';
import { freezeClock, installIntersectionObserver, NOW, richState } from './__fixtures__/viewKit';

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  resetCoachMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const healthy = (over: Parameters<typeof coachState>[0] = {}) =>
  coachState(over, { ...richState(), injuries: [], restPeriods: [], sleeps: [] });

describe('CoachView thread: header and portrait', () => {
  it('names Atlas with his temper and role and closes from Back', async () => {
    const { onClose } = await openThread(healthy());
    const head = document.querySelector('.atl-head') as HTMLElement;
    expect(head.querySelector('.atl-head-text b')?.textContent).toContain(`${en.atlasName}`);
    expect(head.querySelector('.atl-temper-inline')?.textContent).toBe(`· ${en.atlasTemper[1]}`);
    expect(head.textContent).toContain(en.atlasRoleMainShort);
    fireEvent.click(within(head).getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a gentler face and says why while an injury is active', async () => {
    await openThread(coachState({ temper: 5 }));
    const head = document.querySelector('.atl-head-text') as HTMLElement;
    expect(head.textContent).toContain(en.atlasSoftened);
    expect(head.querySelector('.atl-temper-inline')?.textContent).not.toBe(
      `· ${en.atlasTemper[2]}`,
    );
    expect(coach().temper).toBe(5);
  });

  it('an extra coach says so', async () => {
    await openThread(coachState({ role: 'extra' }));
    expect(document.querySelector('.atl-head-text')?.textContent).toContain(en.atlasRoleExtraShort);
    expect(document.querySelector('.atl-plan, .atl-group')).toBeNull();
  });

  it('tapping the face opens the portrait, which closes on click and on Escape', async () => {
    await openThread(healthy());
    const open = () => fireEvent.click(screen.getByRole('button', { name: en.atlasName }));
    open();
    const portrait = document.querySelector('.atl-portrait') as HTMLElement;
    expect(portrait.getAttribute('aria-label')).toBe(`${en.atlasName} · ${en.atlasTemper[1]}`);
    expect(portrait.querySelector('img')?.getAttribute('src')).toBe('/atlas/atlas-3-full.webp');
    fireEvent.click(portrait);
    expect(document.querySelector('.atl-portrait')).toBeNull();
    open();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(document.querySelector('.atl-portrait')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.atl-portrait')).toBeNull();
  });
});

describe('CoachView thread: programme card', () => {
  it('without a plan offers to write one, and writing stores a proposed block', async () => {
    await openThread(coachState({ plan: undefined }));
    expect(screen.getByText(en.atlasPlanOffer)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.atlasPlanWrite }));
    const plan = coach().plan!;
    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.weeks).toBeGreaterThan(0);
    expect(document.querySelector('.atl-plan')).not.toBeNull();
    expect(screen.queryByText(en.atlasPlanOffer)).toBeNull();
  });

  it('shows the block week, the progress bar, each weekday and marks today', async () => {
    // NOW is Saturday 2026-09-26; block started 14 days earlier -> week 3 of 6.
    await openThread();
    const card = document.querySelector('.atl-plan') as HTMLElement;
    expect(card.querySelector('.atl-plan-kicker')?.textContent).toBe(en.atlasPlanKicker(3, 6, 3));
    const bar = [...card.querySelectorAll('.atl-plan-bar span')].map((s) => s.className);
    expect(bar).toEqual(['done', 'done', 'now', '', '', '']);
    const days = [...card.querySelectorAll('.atl-plan-day')];
    expect(days.map((d) => d.querySelector('.atl-plan-name b')?.textContent)).toEqual([
      en.splitNames.push,
      'Leg day',
      en.splitNames.pull,
    ]);
    expect(days[0].querySelector('.atl-plan-name span')?.textContent).toBe(
      `${en.muscleGroups.chest} · ${en.muscleGroups.shoulders}`,
    );
    expect(card.querySelector('.atl-plan-day.today')).toBeNull();
    expect(card.querySelector('.atl-plan-meta')?.textContent).toContain(en.atlasPlanMeta(60, true));
  });

  it('marks the weekday that is today', async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 12, 0)); // Friday
    await openThread();
    const today = document.querySelector('.atl-plan-day.today') as HTMLElement;
    expect(today.querySelector('.atl-plan-name b')?.textContent).toBe(en.splitNames.pull);
    expect(today.querySelector('.atl-plan-today')?.textContent).toBe(en.atlasToday);
  });

  it('Rewrite replaces the plan', async () => {
    await openThread();
    const before = coach().plan!;
    fireEvent.click(screen.getByRole('button', { name: en.atlasPlanRewrite }));
    expect(coach().plan).not.toBe(before);
    expect(coach().plan!.createdAt).toBe(NOW);
  });

  it('a finished block shows the done label and offers a new block; a deload week is flagged', async () => {
    const plan = coach().plan;
    const base = coachState();
    await openThread({
      ...base,
      coach: { ...base.coach, plan: { ...base.coach.plan!, blockStart: NOW - 60 * 86_400_000 } },
    });
    expect(document.querySelector('.atl-plan-kicker')?.textContent).toBe(en.atlasPlanDone);
    expect(screen.getByRole('button', { name: en.atlasPlanNewBlock })).toBeTruthy();
    expect(plan === undefined || plan !== null).toBe(true);
  });
});

describe('CoachView thread: notes and read marks', () => {
  it('lists Atlas notes from the data; unread ones are highlighted behind a New divider', async () => {
    await openThread(coachState({ readAt: 0 }));
    expect(document.querySelectorAll('[data-note-id]').length).toBeGreaterThan(0);
    const unread = document.querySelectorAll('.atl-unread');
    expect(unread.length).toBeGreaterThan(0);
    expect(document.querySelector('.uichat-new')?.textContent).toBe(
      en.atlasNewNotes(unread.length),
    );
  });

  it('no divider when everything has been read', async () => {
    await openThread(coachState({ readAt: NOW + 1000 }));
    expect(document.querySelector('.uichat-new')).toBeNull();
    expect(document.querySelector('.atl-unread')).toBeNull();
  });

  it('a note scrolling into view is marked read after a short debounce, once per burst', async () => {
    const io = installIntersectionObserver();
    await openThread(coachState({ readAt: 0 }));
    const els = [...document.querySelectorAll<HTMLElement>('[data-note-at]')];
    const latest = Math.max(...els.map((e) => Number(e.dataset.noteAt)));
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) io.intersect(el);
    expect(coach().readAt).toBe(0);
    await new Promise((r) => setTimeout(r, 800));
    expect(coach().readAt).toBe(latest);
  });

  it('leaving with a pending read mark flushes it', async () => {
    const io = installIntersectionObserver();
    const { unmount } = await openThread(coachState({ readAt: 0 }));
    const el = document.querySelector<HTMLElement>('[data-note-at]')!;
    io.intersect(el);
    unmount();
    expect(coach().readAt).toBe(Number(el.dataset.noteAt));
  });

  it('a note link in the hash scrolls to that note, centred', async () => {
    const first = await openThread(coachState({ readAt: 0 }));
    const id = document.querySelector<HTMLElement>('[data-note-id]')!.dataset.noteId!;
    first.unmount();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.location.hash = `#/coach?note=${id}`;
    await openThread(coachState({ readAt: 0 }));
    window.location.hash = '';
    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('otherwise the thread follows the newest message to the bottom', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await openThread(coachState({ readAt: 0 }));
    expect(scroll).toHaveBeenCalledWith({ block: 'end' });
  });
});

describe('CoachView thread: settings sheet', () => {
  const sheet = () => [...document.querySelectorAll('.atl-sheet')].pop() as HTMLElement;
  const openSettings = async (state = coachState()) => {
    const out = await openThread(state);
    fireEvent.click(screen.getByRole('button', { name: en.atlasSettings }));
    return out;
  };

  it('Save is disabled until something changes, then stores the draft and closes', async () => {
    await openSettings();
    const save = within(sheet()).getByRole('button', { name: en.atlasSave });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    const radios = within(sheet()).getAllByRole('radio');
    fireEvent.click(radios[2]);
    expect((save as HTMLButtonElement).disabled).toBe(false);
    // Savage turns the extras on by default
    expect(
      (within(sheet()).getByRole('switch', { name: en.atlasRuleMom }) as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(save);
    expect(coach().temper).toBe(5);
    expect(coach().yoMama).toBe(true);
    expect(coach().swearing).toBe(true);
  });

  it('extras are locked for gentler tempers and keepTemper toggles', async () => {
    await openSettings();
    const mom = within(sheet()).getByRole('switch', { name: en.atlasRuleMom }) as HTMLInputElement;
    expect(mom.disabled).toBe(true);
    expect(sheet().textContent).toContain(en.atlasRuleHardOnly);
    expect(sheet().textContent).toContain(en.atlasRuleMercilessOnly);
    fireEvent.click(within(sheet()).getByRole('switch', { name: en.atlasKeepTemper }));
    fireEvent.click(within(sheet()).getByRole('button', { name: en.atlasSave }));
    expect(coach().keepTemper).toBe(true);
  });

  it('picking the already selected temper changes nothing', async () => {
    await openSettings();
    fireEvent.click(within(sheet()).getAllByRole('radio')[1]);
    expect(
      (within(sheet()).getByRole('button', { name: en.atlasSave }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  const action = (label: string) =>
    [...sheet().querySelectorAll('.sheet-actions button, .atl-act-pair button')].find(
      (b) => b.textContent === label,
    ) as HTMLElement;

  it('Turn off asks first; confirming disables the coach and Cancel goes back', async () => {
    await openSettings();
    fireEvent.click(action(en.atlasTurnOff));
    expect(sheet().textContent).toContain(en.atlasTurnOffBody);
    fireEvent.click(action(en.atlasCancel));
    expect(coach().enabled).toBe(true);
    fireEvent.click(action(en.atlasTurnOff));
    fireEvent.click(action(en.atlasTurnOff));
    expect(coach().enabled).toBe(false);
  });

  it('Clear asks first; confirming wipes the conversation and moves the read mark', async () => {
    await openSettings();
    fireEvent.click(action(en.atlasClear));
    expect(sheet().textContent).toContain(en.atlasClearBody);
    fireEvent.click(action(en.atlasClear));
    expect(coach().clearedAt).toBe(NOW);
    expect(coach().readAt).toBe(NOW);
    expect(coach().enabled).toBe(true);
  });

  it('explains why Atlas is gentler than picked while an injury is on', async () => {
    const base = richState();
    await openSettings(coachState({ temper: 5 }, base));
    expect(document.querySelector('.atl-head-text')?.textContent).toContain(en.atlasSoftened);
    const note = en.atlasSoftNote('X').split('X')[0];
    expect(sheet().textContent).toContain(note);
    fireEvent.click(within(sheet()).getByRole('switch', { name: en.atlasKeepTemper }));
    expect(sheet().textContent).not.toContain(note);
  });
});
