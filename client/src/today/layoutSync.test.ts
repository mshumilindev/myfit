import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LAYOUT,
  addSection,
  getTodayLayout,
  moveSection,
  resetTodayLayout,
  setTodayLayout,
  type TodayLayout,
} from './layout';
import {
  layoutFromDoc,
  layoutToDoc,
  pushTodayLayoutEdits,
  reconcileTodayLayout,
  syncTodayLayoutFromDoc,
} from './layoutSync';

const ids = (l: TodayLayout) => l.sections.map((s) => s.id);
const at = (l: TodayLayout, updatedAt: number): TodayLayout => ({ ...l, updatedAt });
const moved = moveSection(DEFAULT_LAYOUT, 'history', -1, 0); // status, atlas, program, history, nudges

let stop: (() => void) | null = null;
beforeEach(() => {
  localStorage.clear();
  resetTodayLayout();
});
afterEach(() => {
  stop?.();
  stop = null;
});

describe('reconcileTodayLayout (last-write-wins by updatedAt)', () => {
  const local = at(DEFAULT_LAYOUT, 100);
  it('newer remote is applied', () => {
    const remote = at(moved, 200);
    expect(reconcileTodayLayout(local, remote)).toEqual({ apply: remote, push: false });
  });
  it('newer local is pushed', () => {
    expect(reconcileTodayLayout(local, at(moved, 50))).toEqual({ apply: null, push: true });
  });
  it('missing remote: push only a locally edited layout', () => {
    expect(reconcileTodayLayout(local, null)).toEqual({ apply: null, push: true });
    expect(reconcileTodayLayout(DEFAULT_LAYOUT, null)).toEqual({ apply: null, push: false });
  });
  it('same stamp: identical is a no-op, a tie goes to the synced copy', () => {
    expect(reconcileTodayLayout(local, at(DEFAULT_LAYOUT, 100))).toEqual({
      apply: null,
      push: false,
    });
    const remote = at(moved, 100);
    expect(reconcileTodayLayout(local, remote)).toEqual({ apply: remote, push: false });
  });
});

describe('layoutFromDoc', () => {
  it('reads the field pair and normalizes the cloud value', () => {
    const l = layoutFromDoc({
      todayLayout: {
        v: 1,
        sections: [
          { id: 'history', kind: 'core' },
          { id: 'status', kind: 'core' },
          { id: 'bogus', kind: 'core' },
          {
            id: 'c1',
            kind: 'custom',
            title: 'Body',
            layout: 'pair',
            items: [{ id: 'w', widget: 'x', size: 'XL' }, 7],
          },
          { id: 'c2', kind: 'custom', title: 'Bad', layout: 'nope', items: [] },
          'junk',
        ],
      },
      todayLayoutUpdatedAt: 300,
    });
    expect(l?.updatedAt).toBe(300);
    expect(ids(l!)).toEqual(['status', 'history', 'c1', 'atlas', 'program', 'nudges']);
    const c1 = l!.sections.find((s) => s.id === 'c1');
    expect(c1?.kind === 'custom' && c1.items).toEqual([{ id: 'w', widget: 'x', size: 'S' }]);
  });
  it('missing or unusable field → null', () => {
    expect(layoutFromDoc({})).toBeNull();
    expect(layoutFromDoc({ todayLayout: { v: 2, sections: [] } })).toBeNull();
    expect(layoutFromDoc({ todayLayout: 'x' })).toBeNull();
  });
  it('round-trips through layoutToDoc', () => {
    const l = addSection(DEFAULT_LAYOUT, { id: 'c1', title: 'T', layout: 'quad' }, 'nudges', 42);
    expect(layoutFromDoc(layoutToDoc(l))).toEqual(l);
  });
});

describe('sync against the prefs doc', () => {
  it('a newer cloud layout is applied locally and not written back', () => {
    const write = vi.fn();
    stop = pushTodayLayoutEdits(write);
    setTodayLayout(at(DEFAULT_LAYOUT, 100));
    write.mockClear();

    syncTodayLayoutFromDoc(layoutToDoc(at(moved, 200)), write);
    expect(ids(getTodayLayout())).toEqual(ids(moved));
    expect(getTodayLayout().updatedAt).toBe(200);
    expect(JSON.parse(localStorage.getItem('spotter.todayLayout')!).updatedAt).toBe(200);
    expect(write).not.toHaveBeenCalled();
  });

  it('an older cloud layout is ignored and the local one pushed', () => {
    setTodayLayout(at(moved, 500));
    const write = vi.fn();
    syncTodayLayoutFromDoc(layoutToDoc(at(DEFAULT_LAYOUT, 100)), write);
    expect(ids(getTodayLayout())).toEqual(ids(moved));
    expect(write).toHaveBeenCalledWith(layoutToDoc(getTodayLayout()));
  });

  it('first sign-in with no cloud copy: an untouched local layout is not pushed', () => {
    const write = vi.fn();
    syncTodayLayoutFromDoc({}, write);
    expect(write).not.toHaveBeenCalled();
    setTodayLayout(at(moved, 10));
    syncTodayLayoutFromDoc({}, write);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('local edits push once; our own write coming back is a no-op', () => {
    const write = vi.fn();
    stop = pushTodayLayoutEdits(write);
    setTodayLayout(at(moved, 700));
    expect(write).toHaveBeenCalledTimes(1);
    const echoed = write.mock.calls[0][0] as Record<string, unknown>;
    const before = getTodayLayout();
    syncTodayLayoutFromDoc(echoed, write);
    expect(getTodayLayout()).toBe(before);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('a local edit carrying a stale stamp still beats the value it replaced', () => {
    syncTodayLayoutFromDoc(layoutToDoc(at(moved, Date.now() + 60_000)), vi.fn());
    const synced = getTodayLayout().updatedAt;
    setTodayLayout({ ...DEFAULT_LAYOUT, updatedAt: 1 });
    expect(getTodayLayout().updatedAt).toBeGreaterThan(synced);
    expect(ids(getTodayLayout())).toEqual(ids(DEFAULT_LAYOUT));
  });
});
