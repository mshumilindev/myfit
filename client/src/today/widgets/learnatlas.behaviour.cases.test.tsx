import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { LEARN_ATLAS_WIDGETS } from './learnatlas';
import { NOW, PRESETS, STATES, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => LEARN_ATLAS_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) => {
  const r = renderWidget(byId(id), size);
  const out = r.container.textContent ?? '';
  r.unmount();
  return out;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  PRESETS.none();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Row = [id: string, size: WidgetSize, parts: string[]];

// Coach on, three lessons watched and six saved (one saved id no longer exists and is dropped).
const PARTIAL: Row[] = [
  ['learn-next', 'M', ['Set up your first workout', 'Basics · 3 of 65 lessons']],
  [
    'learn-next',
    'XL',
    ['3 / 65', 'Library progress', '5%', 'Log a set the fast way', 'Install Spotter on your phone'],
  ],
  ['lesson-of-day', 'M', ['Install Spotter on your phone', 'Lesson of the day · Basics']],
  [
    'lesson-of-day',
    'XL',
    ['Saturday, September 26', 'Up next · Basics', 'Set up your first workout'],
  ],
  ['learn-saved', 'M', ['Saved lessons · 6', 'Next: Log a set the fast way']],
  ['learn-saved', 'XL', ['Unwatched · 5', 'Warm-up sets', 'The rest timer', 'Play all']],
  ['learn-topics', 'M', ['3 of 65 lessons', 'Basics 3/7', 'Topics done · 0 of 10']],
  ['learn-topics', 'XL', ['Logging0/14', 'Cardio & recovery0/6', 'Next: finish Basics']],
  ['atlas-insight', 'M', ['Short night · 5 h', 'Sleep']],
  ['atlas-insight', 'XL', ['Only 5 h of sleep', 'Ask Atlas']],
  ['ask-atlas', 'XL', ['Readiness 80%', 'What should I train today?', 'Am I recovered?']],
  ['atlas-plan', 'M', ['Rest day', 'Next session · Mon']],
  ['atlas-debrief', 'M', ['Debrief · Pull', 'Wins 1 · changes 0']],
  [
    'atlas-debrief',
    'XL',
    ['Friday, September 25', 'Sets8', 'Bent Over Barbell Row 72.5 × 8 — new best', 'Clean session'],
  ],
  [
    'atlas-mood',
    'XL',
    [
      'Bro',
      'Savage',
      'Streak40 d',
      'Readiness80%',
      'Sessions this week3',
      'Injury — going easy on you',
    ],
  ],
  ['atlas-notes', 'M', ['Unread · 9', 'Short night · 5 h · +8 more']],
  [
    'atlas-notes',
    'XL',
    ['Bent Over Barbell Row record · 72.5 kg', 'Barbell Squat record · 112.5 kg'],
  ],
  ['atlas-weekly', 'M', ['Week review · Sep 14–Sep 20', 'Sessions 3 / 3 · 13.1 t']],
  [
    'atlas-weekly',
    'XL',
    [
      'Sessions3 / 3',
      'Lifted13.1 t',
      '3 of 3 sessions, 13.1 t lifted.',
      'Volume −2% vs the week before',
    ],
  ],
  ['atlas-quick-ask', 'XL', ['Try asking', '“What should I train today?”']],
];

describe('learn and Atlas widgets with progress and the coach on', () => {
  it.each(PARTIAL)('%s %s', (id, size, parts) => {
    seed(STATES.coach());
    PRESETS.learnPartial();
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });
});

describe('learn and Atlas widgets with nothing started', () => {
  it.each([
    ['learn-next', 'M', ['Get started in 3 minutes', 'Basics · 0 of 65 lessons']],
    ['learn-next', 'XL', ['0 / 65', '0%', 'Start learning']],
    ['learn-saved', 'M', ['Nothing saved yet', 'Bookmark a lesson in Learn to watch it later']],
    ['learn-saved', 'XL', ['Nothing saved yet', 'Open Learn']],
    ['learn-topics', 'XL', ['0 of 65 lessons', 'Basics0/7']],
    [
      'did-you-know',
      'XL',
      ['Science · 3 of 8', 'More weekly sets, more growth', 'Schoenfeld, Ogborn & Krieger, 2017'],
    ],
    ['ask-atlas', 'M', ['Make me a plan']],
    ['ask-atlas', 'XL', ['Readiness 100%', 'How to squat properly?']],
    ['atlas-quick-ask', 'XL', ['“Make me a plan”', '“How to squat properly?”']],
  ] as Row[])('%s %s', (id, size, parts) => {
    seed(STATES.empty());
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });

  it.each([
    'atlas-insight',
    'atlas-plan',
    'atlas-debrief',
    'atlas-mood',
    'atlas-notes',
    'atlas-weekly',
  ])('%s invites to turn Atlas on while the coach is off', (id) => {
    seed(STATES.rich());
    for (const size of ['M', 'XL'] as const) expect(textOf(id, size), size).toContain('Meet Atlas');
    expect(textOf(id, 'XL')).toContain('Turn on Atlas');
  });
});

describe('chat history shows in the quick-ask widget', () => {
  it('names the last question the user asked', () => {
    seed(STATES.rich());
    PRESETS.chat();
    expect(textOf('atlas-quick-ask', 'XL')).toContain('Last: “Plan for tomorrow?”');
    expect(textOf('ask-atlas', 'XL')).toContain('“Plan for tomorrow?”');
  });
});
