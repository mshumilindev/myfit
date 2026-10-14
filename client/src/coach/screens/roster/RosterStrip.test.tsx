import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rosterEn as r } from '../../../i18n/coachRoster.en';
import type { RosterRow } from '../../domain/roster';
import { RosterStrip } from './RosterStrip';

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    client: { id: `c${i}`, name: `Client ${i}`, hasPhoto: false, live: false },
    status: 'ok',
  })) as unknown as RosterRow[];

let width = 400;
let fire: (() => void) | null = null;
beforeEach(() => {
  width = 400;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('ro-strip') ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width: 70 }) as DOMRect,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const names = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '');

describe('RosterStrip fills its row', () => {
  it('shows as many bubbles as fit and the +N bubble last, then follows a resize', () => {
    render(
      <RosterStrip
        clients={rows(14)}
        max={24}
        r={r}
        onOpen={() => undefined}
        onAll={() => undefined}
      />,
    );
    const first = names();
    expect(first.at(-1)).toMatch(/\+\d+/);
    const shownA = first.length - 1;
    expect(shownA).toBeGreaterThan(1);
    width = 800;
    act(() => fire?.());
    expect(names().length - 1).toBeGreaterThan(shownA);
    width = 200;
    act(() => fire?.());
    expect(names().length - 1).toBeLessThan(shownA);
  });
  it('no +N bubble when everyone fits', () => {
    width = 900;
    render(
      <RosterStrip
        clients={rows(5)}
        max={24}
        r={r}
        onOpen={() => undefined}
        onAll={() => undefined}
      />,
    );
    expect(names().some((n) => /\+\d+/.test(n))).toBe(false);
  });
});
