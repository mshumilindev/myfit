import { currentHash } from '../route';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SHORTCUTS, renderShortcut, shortcutById, type ShortcutCtx } from './shortcuts';
import { ACTIVITY_TYPES } from '../activities';
import {
  NOW,
  emptyState,
  makeCtx,
  richState,
  seed,
  setLocale,
  type ShellSpy,
} from './__fixtures__/widgetHarness';
import type { Activity } from '../types';

function shortcutCtx(over: Partial<ShortcutCtx> = {}): ShortcutCtx & { shell: ShellSpy } {
  return { ...makeCtx(), startToday: null, logPast: vi.fn(), ...over } as ShortcutCtx & {
    shell: ShellSpy;
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  seed(emptyState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.location.hash = '';
});

describe('shortcut catalogue', () => {
  it('has unique ids, one `sc:act:<type>` per activity type and a lookup by id', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACTIVITY_TYPES) expect(shortcutById(`sc:act:${a.key}`)?.icon).toBe(a.icon);
    expect(shortcutById('sc:nope')).toBeUndefined();
    expect(ids.filter((i) => i.startsWith('sc:act:'))).toHaveLength(ACTIVITY_TYPES.length);
  });

  it('colours sport green, recovery blue and the rest conditioning', () => {
    expect(shortcutById('sc:act:tennis')?.tone).toBe('sport');
    expect(shortcutById('sc:act:yoga')?.tone).toBe('rest');
    expect(shortcutById('sc:act:run')?.tone).toBe('conditioning');
  });

  it('labels come from the dictionaries of the active locale', () => {
    const en = shortcutCtx();
    expect(shortcutById('sc:sleep')?.label(en)).toBe('Sleep');
    expect(shortcutById('sc:weigh')?.label(en)).toBe('Weigh-in');
    expect(shortcutById('sc:today')?.label(en)).toBe('Today\u2019s day');
    setLocale('et');
    expect(shortcutById('sc:weigh')?.label(shortcutCtx())).toBe('Kaalumine');
    expect(shortcutById('sc:act:nope')).toBeUndefined();
  });
});

describe('shortcut actions', () => {
  it('"Today\'s day" starts the program day when there is one, else opens the Start sheet', () => {
    const start = vi.fn();
    const withDay = shortcutCtx({ startToday: start });
    shortcutById('sc:today')!.run(withDay);
    expect(start).toHaveBeenCalledTimes(1);
    expect(withDay.shell.calls.openStart).toBeUndefined();

    const without = shortcutCtx();
    shortcutById('sc:today')!.run(without);
    expect(without.shell.calls.openStart).toHaveBeenCalledTimes(1);
  });

  it('auto workout and home set open the Start sheet; log-past, weigh-in call their callbacks', () => {
    const c = shortcutCtx();
    shortcutById('sc:auto')!.run(c);
    shortcutById('sc:home-set')!.run(c);
    expect(c.shell.calls.openStart).toHaveBeenCalledTimes(2);
    shortcutById('sc:log-past')!.run(c);
    expect(c.logPast).toHaveBeenCalledTimes(1);
    shortcutById('sc:weigh')!.run(c);
    expect(c.openWeight).toHaveBeenCalledTimes(1);
  });

  it('each health shortcut opens its form on the right type', () => {
    const c = shortcutCtx();
    const expected: Record<string, unknown> = {
      'sc:sleep': { screen: 'sleep', mode: 'backfill' },
      'sc:active-rest': { screen: 'health', form: { kind: 'new', ctx: 'start', type: 'active' } },
      'sc:day-off': { screen: 'health', form: { kind: 'new', ctx: 'start', type: 'off' } },
      'sc:unwell': { screen: 'health', form: { kind: 'new', ctx: 'start', type: 'illness' } },
      'sc:injury': { screen: 'health', form: { kind: 'new', ctx: 'start', type: 'injury' } },
      'sc:ask-atlas': { screen: 'coach' },
    };
    for (const [id, overlay] of Object.entries(expected)) {
      shortcutById(id)!.run(c);
      expect(c.shell.calls.openOverlay).toHaveBeenLastCalledWith(overlay);
    }
  });

  it('next lesson goes to the Learn app; an activity shortcut opens a new activity of its type', () => {
    const c = shortcutCtx();
    shortcutById('sc:next-lesson')!.run(c);
    expect(currentHash()).toBe('#/learn');
    shortcutById('sc:act:swim')!.run(c);
    expect(c.shell.calls.openOverlay).toHaveBeenLastCalledWith({
      screen: 'activity',
      newType: 'swim',
    });
  });
});

describe('activity shortcut state', () => {
  const act = (over: Partial<Activity>): Activity =>
    ({
      id: 'x',
      type: 'run',
      category: 'conditioning',
      startedAt: NOW - 3_600_000,
      finishedAt: NOW - 1_800_000,
      durationMin: 30,
      ...over,
    }) as Activity;
  const stateOf = (list: Activity[]) => {
    seed({ ...emptyState(), activities: list });
    return shortcutById('sc:act:run')!.state!(shortcutCtx());
  };

  it('is default with nothing logged', () => {
    expect(stateOf([])).toEqual({ state: 'default' });
  });
  it('is done once a finished one of the type exists today, not for yesterday or another type', () => {
    expect(stateOf([act({})]).state).toBe('done');
    expect(
      stateOf([act({ startedAt: NOW - 30 * 3_600_000, finishedAt: NOW - 29 * 3_600_000 })]).state,
    ).toBe('default');
    expect(stateOf([act({ type: 'swim' })]).state).toBe('default');
  });
  it('is live with the elapsed minutes while one is running, and live wins over done', () => {
    const live = act({ id: 'l', startedAt: NOW - 12 * 60_000, finishedAt: null });
    expect(stateOf([act({}), live])).toEqual({ state: 'live', meta: '12 min' });
    // a start time in the future never shows negative minutes
    expect(stateOf([act({ startedAt: NOW + 60_000, finishedAt: null })]).meta).toBe('0 min');
  });
});

describe('renderShortcut', () => {
  it('renders a labelled tile that runs the shortcut on click', () => {
    const c = shortcutCtx();
    render(renderShortcut(shortcutById('sc:weigh')!, c));
    fireEvent.click(screen.getByRole('button', { name: /Weigh-in/ }));
    expect(c.openWeight).toHaveBeenCalledTimes(1);
  });

  it('a custom onClick replaces the action; selected marks the tile pressed; live shows its minutes', () => {
    const c = shortcutCtx();
    const onClick = vi.fn();
    const { rerender } = render(renderShortcut(shortcutById('sc:weigh')!, c, true, onClick));
    const tile = screen.getByRole('button');
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(c.openWeight).not.toHaveBeenCalled();

    seed({
      ...richState(),
      activities: [
        {
          id: 'l',
          type: 'run',
          category: 'conditioning',
          startedAt: NOW - 5 * 60_000,
          finishedAt: null,
          durationMin: 0,
        } as Activity,
      ],
    });
    rerender(renderShortcut(shortcutById('sc:act:run')!, shortcutCtx()));
    expect(screen.getByText('5 min')).toBeTruthy();
    expect(screen.getByRole('button').className).toContain('uisc--live');
  });
});

describe('shortcut labels', () => {
  it('every shortcut has a real label in every locale (never the raw id, never empty)', () => {
    for (const locale of ['en', 'uk', 'pl', 'lt', 'et'] as const) {
      setLocale(locale);
      const c = shortcutCtx();
      for (const def of SHORTCUTS) {
        const label = def.label(c);
        expect(label.trim(), `${def.id}/${locale}`).not.toBe('');
        expect(label, `${def.id}/${locale}`).not.toBe(def.id);
        expect(label).not.toMatch(/undefined/);
      }
    }
  });

  it('English labels of the fixed shortcuts', () => {
    const c = shortcutCtx();
    const labels = Object.fromEntries(
      SHORTCUTS.filter((s) => !s.id.startsWith('sc:act:')).map((s) => [s.id, s.label(c)]),
    );
    expect(labels).toMatchObject({
      'sc:auto': 'Auto session',
      'sc:active-rest': 'Active rest',
      'sc:day-off': 'Day off',
      'sc:unwell': 'Unwell',
      'sc:injury': 'Injury',
      'sc:next-lesson': 'Next lesson',
      'sc:ask-atlas': 'Ask Atlas',
      'sc:sleep': 'Sleep',
    });
    expect(labels['sc:home-set']).toBeTruthy();
    expect(labels['sc:log-past']).toBeTruthy();
  });
});
