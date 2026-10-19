/**
 * Test harness for the Today widgets: a deterministic, synthetic training history, a recording Shell and a helper that
 * renders one widget in one size against real store state. Synthetic data only.
 */
import { NOW } from './widgetData';
import { vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';
import { __getStateForTests, __replaceStateForTests, type StoreState } from '../../store';
import { setLocale, useT, type LocaleId } from '../../i18n';
import { useTw } from '../strings';
import type { WidgetCtx, WidgetDef } from '../registry';
import type { WidgetSize } from '../../components/ui/Widget';
import type { Shell } from '../../App';

export type ShellSpy = Shell & { calls: Record<string, ReturnType<typeof vi.fn>> };

/** A Shell whose every function is a spy (looked up lazily by name). */
export function makeShell(): ShellSpy {
  const calls: Record<string, ReturnType<typeof vi.fn>> = {};
  return new Proxy({ queueLength: 0, calls } as unknown as ShellSpy, {
    get(target, prop: string) {
      if (prop in target) return (target as unknown as Record<string, unknown>)[prop];
      return (calls[prop] ??= vi.fn());
    },
  });
}

export function seed(state: StoreState): void {
  __replaceStateForTests(state);
}

export function makeCtx(
  over: Partial<WidgetCtx> = {},
): WidgetCtx & { shell: ShellSpy; openWeight: ReturnType<typeof vi.fn> } {
  const { t, locale, tw } = renderHook(() => ({ ...useT(), tw: useTw() })).result.current;
  return {
    store: __getStateForTests(),
    now: NOW,
    t,
    tw,
    locale,
    shell: makeShell(),
    openWeight: vi.fn(),
    ...over,
  } as never;
}

export function renderWidget(def: WidgetDef, size: WidgetSize, over: Partial<WidgetCtx> = {}) {
  const ctx = makeCtx(over);
  const view = render(<>{def.render(size, ctx) as ReactElement}</>);
  return { ...view, ctx };
}

export { setLocale };
export type { LocaleId };

export * from './widgetData';
export * from './widgetStates';
export * from './widgetPresets';
