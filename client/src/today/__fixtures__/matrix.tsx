/**
 * Shared matrix: every widget of a group, in every size, against several real store states. The assertions are the
 * ones that must hold for ANY widget — it renders something, it does not throw, it logs no React error — plus a
 * click through every control (a control must not throw and must leave the widget rendered).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import type { WidgetDef } from '../registry';
import { WIDGET_SIZES } from '../../components/ui/Widget';
import {
  NOW,
  PRESETS,
  STATES,
  renderWidget,
  seed,
  setLocale,
  type LocaleId,
} from './widgetHarness';

const CONTROLS = 'button,[role=button],[role=tab],[role=switch],input,select,textarea,a';

export function clickThrough(root: HTMLElement = document.body, passes = 3): number {
  let clicked = 0;
  for (let pass = 0; pass < passes; pass++) {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(CONTROLS))) {
      if (!el.isConnected || (el as HTMLButtonElement).disabled) continue;
      act(() => {
        if (el instanceof HTMLInputElement && el.type === 'range')
          fireEvent.change(el, { target: { value: '3' } });
        else if (el instanceof HTMLInputElement && el.type === 'text')
          fireEvent.change(el, { target: { value: 'x' } });
        else fireEvent.click(el);
      });
      clicked++;
    }
  }
  return clicked;
}

/** [store state, device presets] pairs the matrix visits; chosen so every branch family (empty, rich, live session, layoff, coach on/off, programme, local values) is reached. */
export const SCENARIOS: Array<[string, string]> = [
  ['empty', 'none'],
  ['empty', 'local'],
  ['empty', 'localCorrupt'],
  ['rich', 'none'],
  ['rich', 'program'],
  ['rich', 'local'],
  ['rich', 'localCorrupt'],
  ['coach', 'program'],
  ['coach', 'local'],
  ['coachStalled', 'program'],
  ['coachStreak', 'program'],
  ['live', 'program'],
  ['layoff', 'program'],
  ['justStarted', 'none'],
  ['coachRed', 'none'],
  ['coachLayoff', 'local'],
  ['coachLive', 'program'],
  ['coachEmpty', 'none'],
  ['sleepGood', 'program'],
  ['sleepLive', 'none'],
  ['rich', 'apex'],
  ['coach', 'apex'],
  ['rich', 'apexDone'],
  ['rich', 'apexTimeUp'],
  ['coach', 'learnPartial'],
  ['rich', 'learnAll'],
  ['rich', 'learnCorrupt'],
  ['empty', 'learnPartial'],
  ['coach', 'chat'],
  ['coach', 'chatPending'],
  ['rich', 'chat'],
  ['planToday', 'program'],
  ['planTodayNamed', 'program'],
  ['planTodayEmpty', 'none'],
  ['coachBusy', 'program'],
  ['busyToday', 'program'],
  ['homeSets', 'program'],
  ['thinBody', 'none'],
  ['unwell', 'program'],
];

export function widgetMatrix(
  name: string,
  defs: WidgetDef[],
  opts: {
    scenarios?: Array<[string, string]>;
    locales?: LocaleId[];
    setup?: () => void;
  } = {},
): void {
  const scenarios = opts.scenarios ?? SCENARIOS;
  const locales = opts.locales ?? ['en'];
  describe(`${name} — every widget x size x scenario`, () => {
    let errors: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
      localStorage.clear();
      opts.setup?.();
      errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
      cleanup();
      vi.useRealTimers();
      errors.mockRestore();
    });
    for (const locale of locales) {
      for (const [state, preset] of scenarios) {
        for (const def of defs) {
          it(`${def.id} [${state}+${preset}/${locale}] renders in S M L XL, controls respond, no React error`, () => {
            setLocale(locale);
            seed(STATES[state]());
            PRESETS[preset]();
            for (const size of WIDGET_SIZES) {
              const { container, unmount, ctx } = renderWidget(def, size);
              expect(container.innerHTML, `${def.id} ${size} rendered nothing`).not.toBe('');
              expect(def.name(ctx.tw).trim(), `${def.id} has no picker name in ${locale}`).not.toBe(
                '',
              );
              clickThrough();
              expect(container.innerHTML).not.toBe('');
              unmount();
            }
            expect(errors).not.toHaveBeenCalled();
          });
        }
      }
    }
  });
}
