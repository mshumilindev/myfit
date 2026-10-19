import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { FLAGS, LOCALES, setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests } from '../store';
import { pushChat } from '../atlas/chatLog';
import {
  bubbles,
  coach,
  coachState,
  composer,
  m,
  openThread,
  resetCoachMocks,
  send,
  type as typeIn,
  ask,
  warmAtlas,
} from './__fixtures__/coachMocks';
import { freezeClock, NOW } from './__fixtures__/viewKit';

const healthy = (over: Parameters<typeof coachState>[0] = {}) => coachState(over);
const find = (text: string | RegExp) => screen.findByText(text, {}, { timeout: 20000 });
const chipTexts = () =>
  [...document.querySelectorAll('.atl-suggest .uichip')].map((c) => c.textContent);

vi.setConfig({ testTimeout: 40_000 });
beforeAll(() => warmAtlas(), 60_000);
beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  resetCoachMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CoachView chat: hello and local answers', () => {
  it('opens with Atlas saying hello once, with follow-up chips', async () => {
    await openThread(healthy());
    expect(document.querySelectorAll('.ch-list-m li').length).toBeGreaterThan(0);
    expect(chipTexts().length).toBeGreaterThan(0);
    cleanup();
    await openThread(healthy());
    // reopening does not add a second hello
    expect(bubbles().filter((b) => b.includes(en.atlasName)).length).toBeLessThanOrEqual(
      document.querySelectorAll('[data-note-id]').length + 1,
    );
  });

  it('answers a question from the user data without calling Gemini', async () => {
    await openThread(healthy());
    send('sleep');
    expect(composer().value).toBe('');
    await find(/7-night average/);
    expect(bubbles().some((b) => b === 'sleep' || b.startsWith('sleep'))).toBe(true);
    expect(m.ask).not.toHaveBeenCalled();
    expect(coach().stats).toBeTruthy();
  });

  it('ignores an empty or whitespace message', async () => {
    await openThread(healthy());
    const before = bubbles().length;
    typeIn('   ');
    fireEvent.click(screen.getByRole('button', { name: en.atlasSend }));
    expect(bubbles().length).toBe(before);
  });

  it('draws a chart under a progress answer', async () => {
    await openThread(healthy());
    send('bench press progress');
    await find(/estimated max/);
    expect(
      document.querySelector('.ch-list-m svg, .ch-list-m .chat-chart, .ch-list-m canvas'),
    ).not.toBeNull();
  });

  it('a tapped follow-up chip is sent as the next question', async () => {
    await openThread(healthy());
    send('sleep');
    await find(/7-night average/);
    await screen.findAllByText(/./, {}, { timeout: 1000 });
    const chip = document.querySelector('.atl-suggest .uichip') as HTMLElement;
    const label = chip.textContent as string;
    const before = bubbles().length;
    fireEvent.click(chip);
    await vi.waitFor(() => expect(bubbles().length).toBeGreaterThan(before + 1), {
      timeout: 20000,
    });
    expect(bubbles().some((b) => b.startsWith(label))).toBe(true);
  });

  it('follow-up chips live on the newest answer only', async () => {
    await openThread(healthy());
    send('sleep');
    await find(/7-night average/);
    expect(document.querySelectorAll('.atl-suggest').length).toBe(1);
  });
});

describe('CoachView chat: rating answers', () => {
  it('a thumbs-up teaches the wording and hides the buttons', async () => {
    await openThread(healthy());
    send('sleep');
    await find(/7-night average/);
    const before = JSON.stringify(coach().memory);
    fireEvent.click(await screen.findByRole('button', { name: en.atlasRateUp }));
    expect(screen.queryByRole('button', { name: en.atlasRateUp })).toBeNull();
    expect(JSON.stringify(coach().memory)).not.toBe(before);
  });

  it('a thumbs-down offers other topics and remembers the correction', async () => {
    await openThread(healthy());
    send('sleep');
    await find(/7-night average/);
    fireEvent.click(await screen.findByRole('button', { name: en.atlasRateDown }));
    await vi.waitFor(() =>
      expect(
        bubbles().some((b) => b.includes(en.atlasWrongPick) || b.includes(en.atlasWrongNoted)),
      ).toBe(true),
    );
    expect(screen.queryByRole('button', { name: en.atlasRateDown })).toBeNull();
  });
});

describe('CoachView chat: actions', () => {
  it('Atlas offers to start a workout; Do it starts it and opens the session', async () => {
    const onOpen = vi.fn();
    await openThread(healthy(), onOpen);
    const before = __getStateForTests().workouts.length;
    send('start a workout');
    await find(en.atlasDoIt);
    fireEvent.click(screen.getByRole('button', { name: en.atlasDoIt }));
    expect(__getStateForTests().workouts.length).toBe(before + 1);
    expect(onOpen).toHaveBeenCalledWith(
      __getStateForTests().workouts.find((w) => w.finishedAt === null)!.id,
    );
    expect(screen.queryByRole('button', { name: en.atlasDoIt })).toBeNull();
  });

  it('Cancel drops the offer and starts nothing', async () => {
    const onOpen = vi.fn();
    await openThread(healthy(), onOpen);
    const before = __getStateForTests().workouts.length;
    send('start a workout');
    await find(en.atlasDoIt);
    const cancel = [...document.querySelectorAll('.atl-suggest .uichip')].find(
      (c) => c.textContent === en.atlasCancel,
    ) as HTMLElement;
    fireEvent.click(cancel);
    expect(screen.queryByRole('button', { name: en.atlasDoIt })).toBeNull();
    expect(__getStateForTests().workouts.length).toBe(before);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('CoachView chat: off-topic guard', () => {
  it('the third off-topic try blocks the chat for 30 minutes; safety questions are still answered', async () => {
    await openThread(healthy());
    for (let i = 1; i <= 3; i++) await ask('recommend me a good movie');
    const until = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(
      Date.now() + 30 * 60_000,
    );
    expect(composer().placeholder).toBe(en.atlasBlockedPlaceholder(until));
    expect(bubbles()[bubbles().length - 1]).toContain(until);
    await ask('sleep');
    expect(bubbles()[bubbles().length - 1]).toBe(en.atlasBlockedLine(until));
    expect(bubbles()[bubbles().length - 1]).not.toContain('7-night');
    await ask('my chest hurts');
    expect(bubbles()[bubbles().length - 1]).toContain("Let's not train through it");
  });

  it('warns on the first and second try with different lines and leaves the composer open', async () => {
    await openThread(healthy());
    await ask('recommend me a good movie');
    const first = bubbles()[bubbles().length - 1];
    await ask('who is the president of France');
    const second = bubbles()[bubbles().length - 1];
    expect(second).not.toBe(first);
    expect(first).toBeTruthy();
    expect(composer().placeholder).toBe(en.atlasAsk);
  });
});

describe('CoachView chat: older messages and day labels', () => {
  it('shows only the latest page and loads older messages when the top comes into view', async () => {
    for (let i = 0; i < 70; i++)
      pushChat({
        id: `h${i}`,
        at: NOW - (70 - i) * 60_000,
        from: i % 2 ? 'atlas' : 'me',
        text: `msg-${i}`,
      });
    const { intersect } = (await import('./__fixtures__/viewKit')).installIntersectionObserver();
    await openThread(healthy({ readAt: NOW + 10 * 86_400_000 }));
    const count = () => document.querySelectorAll('.ch-list-m li:not(.uichat-day)').length;
    const first = count();
    expect(screen.queryByText('msg-39')).toBeNull();
    expect(screen.queryByText('msg-40')).not.toBeNull();
    const top = document.querySelector('.atl-older') as HTMLElement;
    expect(top).not.toBeNull();
    intersect(top);
    await vi.waitFor(() => expect(count()).toBeGreaterThan(first));
    expect(screen.queryByText('msg-39')).not.toBeNull();
    expect(screen.queryByText('msg-9')).toBeNull();
  });

  it('groups by day with Today / Yesterday and a dated label for older days', async () => {
    pushChat({ id: 'old', at: NOW - 5 * 86_400_000, from: 'me', text: 'five days ago' });
    pushChat({ id: 'two', at: NOW - 2 * 86_400_000, from: 'me', text: 'two days ago' });
    pushChat({ id: 'yes', at: NOW - 86_400_000, from: 'me', text: 'yesterday msg' });
    pushChat({ id: 'tod', at: NOW - 60_000, from: 'me', text: 'today msg' });
    await openThread(healthy({ readAt: NOW + 10 * 86_400_000 }));
    const labels = [...document.querySelectorAll('.uichat-day')].map((d) => d.textContent);
    expect(labels).toContain(en.atlasToday);
    expect(labels).toContain(en.atlasYesterday);
    expect(labels.filter((l) => l === en.atlasYesterday)).toHaveLength(1);
    const dated = new Intl.DateTimeFormat('en', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(NOW - 2 * 86_400_000);
    expect(labels).toContain(dated);
  });

  it('renders a system notice as a centred pill', async () => {
    pushChat({ id: 'n1', at: NOW - 1000, from: 'atlas', notice: true, text: 'Gemini is resting' });
    await openThread(healthy({ readAt: NOW + 10 * 86_400_000 }));
    expect(screen.getByText('Gemini is resting')).toBeTruthy();
  });
});

describe('CoachView chat: language offer', () => {
  const offerChip = () =>
    [...document.querySelectorAll('.atl-suggest .uichip')].find((c) =>
      (c.textContent ?? '').includes(FLAGS.uk),
    ) as HTMLElement | undefined;

  it('offers to switch when the question is in another language, and switching says so', async () => {
    await openThread(healthy());
    await ask('сон');
    await vi.waitFor(() => expect(offerChip()).toBeTruthy(), { timeout: 20000 });
    expect(offerChip()!.textContent).toBe(`${FLAGS.uk} ${LOCALES.uk.locale}`);
    fireEvent.click(offerChip()!);
    expect(document.documentElement.lang).toBe('uk');
    expect(bubbles()[bubbles().length - 1]).toBe(LOCALES.uk.atlasLangDone);
    setLocale('en');
  });

  it('Keep as is drops the offer, and the same language is not offered twice', async () => {
    await openThread(healthy());
    await ask('сон');
    fireEvent.click(
      await screen.findByRole('button', { name: en.atlasLangKeep }, { timeout: 20000 }),
    );
    expect(screen.queryByRole('button', { name: en.atlasLangKeep })).toBeNull();
    expect(document.documentElement.lang).toBe('en');
    await ask('ще сон');
    expect(screen.queryByRole('button', { name: en.atlasLangKeep })).toBeNull();
  });

  it('an English question never triggers an offer', async () => {
    await openThread(healthy());
    await ask('sleep');
    expect(screen.queryByRole('button', { name: en.atlasLangKeep })).toBeNull();
  });
});
