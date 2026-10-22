import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { APEX_WIDGETS } from './apex';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => APEX_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('apex widgets', APEX_WIDGETS);
widgetMatrix('apex widgets (other locales)', APEX_WIDGETS, {
  locales: ['uk', 'pl', 'lt', 'et'],
  scenarios: [
    ['rich', 'apex'],
    ['empty', 'none'],
  ],
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  PRESETS.none();
});
afterEach(() => {
  cleanup();
  PRESETS.none();
  vi.useRealTimers();
});

describe('Apex challenge', () => {
  it('shows the empty state without an active challenge', () => {
    seed(STATES.rich());
    expect(textOf('apex-challenge', 'M')).toMatch(/No active challenges/i);
  });

  it('shows progress, deadline and the extra-challenge count for a running challenge', () => {
    seed(STATES.rich());
    PRESETS.apex();
    const m = textOf('apex-challenge', 'M');
    expect(m).toContain('12 sessions');
    expect(m).toContain('9 days left');
    expect(textOf('apex-challenge', 'L')).toContain('+1 more active');
  });
});

describe('Apex challenge outcomes', () => {
  it('a reached target reads as reached', () => {
    seed(STATES.rich());
    PRESETS.apexDone();
    const text = textOf('apex-challenge', 'L');
    expect(text).toContain('100%');
    expect(text).toContain('Target reached');
  });

  it('an expired challenge no longer shows a pace', () => {
    seed(STATES.rich());
    PRESETS.apexTimeUp();
    const text = textOf('apex-challenge', 'L');
    expect(text).toContain('Time is up');
    expect(text).toContain('0 days left');
  });
});

describe('Apex feed', () => {
  it('lists the newest notification first and counts the rest', () => {
    seed(STATES.rich());
    PRESETS.apex();
    expect(textOf('apex-feed', 'S')).toContain('New PR: Barbell Squat');
    expect(textOf('apex-feed', 'M')).toContain('6 new in Apex');
    const xl = textOf('apex-feed', 'XL');
    expect(xl).toContain('Challenge done');
    expect(xl.indexOf('New PR')).toBeLessThan(xl.indexOf('7-day streak'));
  });

  it('shows the empty state with no notifications', () => {
    seed(STATES.rich());
    expect(textOf('apex-feed', 'L')).toMatch(/No milestones yet/i);
  });
});

describe('Apex rank, mastery and feats', () => {
  it('rank names the closest lift and the gap to the next rank', () => {
    seed(STATES.rich());
    expect(textOf('apex-rank', 'M')).toBe('II · Deadlift5 kg to I');
  });

  it('mastery shows a tier and points to the next one', () => {
    seed(STATES.rich());
    expect(textOf('apex-mastery', 'L')).toMatch(/pts to/i);
  });

  it('next feat shows a fractional progress', () => {
    seed(STATES.rich());
    expect(textOf('apex-next-feat', 'M')).toMatch(/\d+%/);
  });

  it('empty history stays readable in every widget', () => {
    seed(STATES.empty());
    for (const w of APEX_WIDGETS) {
      expect(renderWidget(w, 'XL').container.textContent?.length).toBeGreaterThan(0);
      cleanup();
    }
  });
});
