import { describe, expect, it } from 'vitest';
import {
  CORE_DEFAULTS,
  DEFAULT_LAYOUT,
  addSection,
  coreOpts,
  setCoreOpts,
  moveSection,
  moveWidget,
  normalize,
  placeSection,
  removeSection,
  removeWidget,
  setSectionMeta,
  setWidget,
  slotSize,
  layoutChange,
  placeWidget,
  insertWidget,
  freeSlot,
  type CustomSection,
  type TodayLayout,
} from './layout';

const ids = (l: TodayLayout) => l.sections.map((s) => s.id);

describe('today layout', () => {
  it('defaults to the five core sections, status first', () => {
    expect(ids(DEFAULT_LAYOUT)).toEqual(['status', 'atlas', 'program', 'nudges', 'history']);
  });

  it('normalize restores missing core sections, drops duplicates and keeps status first', () => {
    const broken: TodayLayout = {
      v: 1,
      updatedAt: 0,
      sections: [
        { id: 'history', kind: 'core' },
        { id: 'status', kind: 'core' },
        { id: 'history', kind: 'core' },
      ],
    };
    expect(ids(normalize(broken))).toEqual(['status', 'history', 'atlas', 'program', 'nudges']);
  });

  it('moves sections with arrows but never above or with status', () => {
    let l = moveSection(DEFAULT_LAYOUT, 'program', -1);
    expect(ids(l)).toEqual(['status', 'program', 'atlas', 'nudges', 'history']);
    l = moveSection(l, 'program', -1);
    expect(ids(l)[0]).toBe('status');
    expect(moveSection(l, 'status', 1)).toBe(l);
    expect(moveSection(l, 'history', 1)).toBe(l);
  });

  it('places a dragged section at an index, never at 0', () => {
    expect(ids(placeSection(DEFAULT_LAYOUT, 'history', 0))[1]).toBe('history');
  });

  it('adds, fills, reorders and removes a custom section; core cannot be removed', () => {
    let l = addSection(DEFAULT_LAYOUT, { id: 'c1', title: 'Body', layout: 'wide-pair' }, 'nudges');
    expect(ids(l)).toEqual(['status', 'atlas', 'program', 'nudges', 'c1', 'history']);
    l = setWidget(l, 'c1', 0, 'volume', 'w1');
    l = setWidget(l, 'c1', 1, 'readiness', 'w2');
    l = setWidget(l, 'c1', 2, 'sleep', 'w3');
    const c1 = () => l.sections.find((s) => s.id === 'c1');
    const sizes = () => {
      const s = c1();
      return s && s.kind === 'custom' ? s.items.map((w) => `${w.widget}:${w.size}`) : [];
    };
    expect(sizes()).toEqual(['volume:L', 'readiness:S', 'sleep:S']);
    l = moveWidget(l, 'c1', 'w2', -1);
    expect(sizes()).toEqual(['readiness:L', 'volume:S', 'sleep:S']);
    l = removeWidget(l, 'c1', 'w3');
    expect(sizes()).toEqual(['readiness:L', 'volume:S']);
    l = setSectionMeta(l, 'c1', { layout: 'rows' });
    expect(sizes()).toEqual(['readiness:M', 'volume:M']);
    expect(removeSection(l, 'history')).toBe(l);
    expect(ids(removeSection(l, 'c1'))).not.toContain('c1');
  });

  it('slot sizes follow the layout', () => {
    expect(slotSize('shortcuts', 3)).toBe('XS');
    expect(slotSize('big', 0)).toBe('XL');
    expect(slotSize('wide-pair', 0)).toBe('L');
    expect(slotSize('wide-pair', 2)).toBe('S');
  });

  it('core options default to the old behaviour and are not stored', () => {
    expect(coreOpts(DEFAULT_LAYOUT, 'program')).toEqual(CORE_DEFAULTS.program);
    expect(coreOpts(DEFAULT_LAYOUT, 'history').days).toBe(5);
    expect(DEFAULT_LAYOUT.sections.every((s) => !('opts' in s))).toBe(true);
  });

  it('setCoreOpts merges a patch, and dropping back to defaults removes the opts', () => {
    let l = setCoreOpts(DEFAULT_LAYOUT, 'program', { style: 'compact', weekPills: false });
    expect(coreOpts(l, 'program')).toEqual({
      ...CORE_DEFAULTS.program,
      style: 'compact',
      weekPills: false,
    });
    l = setCoreOpts(l, 'program', { style: 'detailed' });
    expect(coreOpts(l, 'program').weekPills).toBe(false);
    expect(coreOpts(l, 'atlas')).toEqual(CORE_DEFAULTS.atlas);
    l = setCoreOpts(l, 'program', null);
    expect(JSON.stringify(l.sections)).toBe(JSON.stringify(DEFAULT_LAYOUT.sections));
    l = setCoreOpts(l, 'history', { days: 5 });
    expect(l.sections.find((s) => s.id === 'history')).toEqual({ id: 'history', kind: 'core' });
  });

  it('nudge switches keep a known, ordered set', () => {
    const l = setCoreOpts(DEFAULT_LAYOUT, 'nudges', { off: ['sleep', 'energy', 'energy'] });
    expect(coreOpts(l, 'nudges').off).toEqual(['energy', 'sleep']);
  });

  it('normalize repairs missing or invalid options', () => {
    const broken = {
      v: 1,
      updatedAt: 0,
      sections: [
        { id: 'status', kind: 'core', opts: { style: 'compact' } },
        { id: 'history', kind: 'core', opts: { days: 9, view: 'calendar' } },
        { id: 'program', kind: 'core', opts: 'nope' },
        { id: 'atlas', kind: 'core', opts: { layout: 'split', liveFirst: 'yes' } },
        { id: 'nudges', kind: 'core', opts: { off: ['learn', 'bogus'] } },
      ],
    } as unknown as TodayLayout;
    const l = normalize(broken);
    const byId = (id: string) => l.sections.find((s) => s.id === id);
    expect(byId('status')).toEqual({ id: 'status', kind: 'core' });
    expect(byId('program')).toEqual({ id: 'program', kind: 'core' });
    expect(coreOpts(l, 'history')).toEqual({ days: 5, view: 'calendar', planned: true });
    expect(coreOpts(l, 'atlas')).toEqual({ ...CORE_DEFAULTS.atlas, layout: 'split' });
    expect(coreOpts(l, 'nudges').off).toEqual(['learn']);
  });

  describe('changing a section layout', () => {
    const base = addSection(DEFAULT_LAYOUT, { id: 'x', title: 'X', layout: 'quad' }, 'nudges', 1);
    const sec = (l: TodayLayout) => l.sections.find((s) => s.id === 'x') as CustomSection;
    const fill = (l: TodayLayout, ws: string[]) =>
      ws.reduce((acc, w, i) => setWidget(acc, 'x', i, w, `w${i}`, 1), l);

    it('re-sizes widgets to the new slots', () => {
      const l = setSectionMeta(fill(base, ['readiness', 'sleep']), 'x', { layout: 'wide-pair' }, 2);
      expect(sec(l).items.map((w) => [w.widget, w.size])).toEqual([
        ['readiness', 'L'],
        ['sleep', 'S'],
      ]);
    });

    it('drops what no longer fits, and reports it first', () => {
      const l = fill(base, ['readiness', 'sleep', 'streak', 'calendar']);
      expect(layoutChange(sec(l), 'wide')).toMatchObject({ overflow: 3, wrongKind: 0 });
      const w = setSectionMeta(l, 'x', { layout: 'wide' }, 2);
      expect(sec(w).items.map((i) => [i.widget, i.size])).toEqual([['readiness', 'L']]);
    });

    it('never puts shortcuts into widget slots or widgets into shortcut slots', () => {
      const sc = setSectionMeta(fill(base, ['readiness']), 'x', { layout: 'shortcuts' }, 2);
      expect(sec(sc).items).toEqual([]);
      const s2 = addSection(
        DEFAULT_LAYOUT,
        { id: 'x', title: 'X', layout: 'shortcuts' },
        'nudges',
        1,
      );
      const withSc = fill(s2, ['sc:today', 'sc:act:run']);
      expect(layoutChange(sec(withSc), 'pair')).toMatchObject({ wrongKind: 2, overflow: 0 });
      expect(sec(setSectionMeta(withSc, 'x', { layout: 'pair' }, 2)).items).toEqual([]);
    });

    it('keeps fixed slots in place: filling a small slot first leaves the wide one empty', () => {
      const wp = addSection(
        DEFAULT_LAYOUT,
        { id: 'x', title: 'X', layout: 'wide-pair' },
        'nudges',
        1,
      );
      const l = setWidget(wp, 'x', 2, 'sleep', 'a', 1);
      const items = sec(l).items;
      expect(items.map((w) => [w.widget, w.size])).toEqual([
        ['', 'L'],
        ['', 'S'],
        ['sleep', 'S'],
      ]);
      const full = setWidget(
        setWidget(l, 'x', 0, 'weekly-volume', 'b', 1),
        'x',
        1,
        'streak',
        'c',
        1,
      );
      const rm = removeWidget(full, 'x', 'b', 2);
      expect(sec(rm).items.map((w) => w.widget)).toEqual(['', 'streak', 'sleep']);
    });

    it('repairs stored sections that hold the wrong kind of item', () => {
      const broken: TodayLayout = {
        ...DEFAULT_LAYOUT,
        sections: [
          ...DEFAULT_LAYOUT.sections,
          {
            id: 'x',
            kind: 'custom',
            title: 'X',
            layout: 'pair',
            items: [{ id: 'a', widget: 'sc:today', size: 'S' }],
          },
        ],
      };
      expect(sec(normalize(broken)).items).toEqual([]);
    });
  });

  describe('desktop drag & drop helpers', () => {
    const custom = (l: TodayLayout, id: string) =>
      l.sections.find((x) => x.id === id) as CustomSection;
    const widgets = (l: TodayLayout, id: string) => custom(l, id).items.map((w) => w.widget);

    it('placeWidget moves an item in a flowing section and closes up', () => {
      let l = addSection(DEFAULT_LAYOUT, { id: 'sc', title: 'S', layout: 'shortcuts' });
      for (const [i, w] of ['sc:today', 'sc:sleep', 'sc:weigh', 'sc:log-past'].entries())
        l = insertWidget(l, 'sc', w, `w${i}`);
      l = placeWidget(l, 'sc', 'w0', 2);
      expect(widgets(l, 'sc')).toEqual(['sc:sleep', 'sc:weigh', 'sc:today', 'sc:log-past']);
      l = placeWidget(l, 'sc', 'w3', 0);
      expect(widgets(l, 'sc')).toEqual(['sc:log-past', 'sc:sleep', 'sc:weigh', 'sc:today']);
      expect(custom(l, 'sc').items.every((w) => w.size === 'XS')).toBe(true);
      // Past the last item or onto itself: nothing changes.
      expect(placeWidget(l, 'sc', 'w3', 4)).toBe(l);
      expect(placeWidget(l, 'sc', 'w3', 0)).toBe(l);
    });

    it('placeWidget swaps in a fixed layout and keeps empty slots in place', () => {
      let l = addSection(DEFAULT_LAYOUT, { id: 'c', title: 'C', layout: 'wide-pair' });
      l = setWidget(l, 'c', 0, 'volume', 'w1');
      l = setWidget(l, 'c', 1, 'readiness', 'w2');
      // Into the empty third slot: the second slot becomes a hole.
      l = placeWidget(l, 'c', 'w2', 2);
      expect(widgets(l, 'c')).toEqual(['volume', '', 'readiness']);
      expect(custom(l, 'c').items.map((w) => w.size)).toEqual(['L', 'S', 'S']);
      // Swapping the wide slot re-sizes both widgets to their new slots.
      l = placeWidget(l, 'c', 'w2', 0);
      expect(widgets(l, 'c')).toEqual(['readiness', '', 'volume']);
      expect(custom(l, 'c').items.map((w) => w.size)).toEqual(['L', 'S', 'S']);
      // Moving the last widget into the hole trims the trailing hole.
      l = placeWidget(l, 'c', 'w1', 1);
      expect(widgets(l, 'c')).toEqual(['readiness', 'volume']);
      expect(placeWidget(l, 'c', 'w1', 3)).toBe(l);
    });

    it('freeSlot finds the first empty compatible slot', () => {
      let l = addSection(DEFAULT_LAYOUT, { id: 'q', title: 'Q', layout: 'quad' });
      l = setWidget(l, 'q', 2, 'volume', 'w1');
      expect(freeSlot(custom(l, 'q'), 'sleep')).toBe(0);
      expect(freeSlot(custom(l, 'q'), 'sc:sleep')).toBe(-1);
      l = addSection(l, { id: 's', title: 'S', layout: 'shortcuts' });
      expect(freeSlot(custom(l, 's'), 'volume')).toBe(-1);
      l = insertWidget(l, 's', 'sc:sleep', 'x1');
      expect(freeSlot(custom(l, 's'), 'sc:sleep')).toBe(-1);
      expect(freeSlot(custom(l, 's'), 'sc:weigh')).toBe(1);
    });

    it('insertWidget refuses duplicates, the wrong kind, fixed layouts and a full row', () => {
      let l = addSection(DEFAULT_LAYOUT, { id: 's', title: 'S', layout: 'shortcuts' });
      l = insertWidget(l, 's', 'sc:sleep', 'a');
      l = insertWidget(l, 's', 'sc:weigh', 'b', 0);
      expect(widgets(l, 's')).toEqual(['sc:weigh', 'sc:sleep']);
      expect(insertWidget(l, 's', 'sc:sleep', 'c')).toBe(l);
      expect(insertWidget(l, 's', 'volume', 'c')).toBe(l);
      const acts = ['run', 'swim', 'yoga', 'padel', 'sauna', 'cycling', 'dance'];
      for (const a of acts) l = insertWidget(l, 's', `sc:act:${a}`, a);
      expect(custom(l, 's').items).toHaveLength(8);
      l = addSection(l, { id: 'p', title: 'P', layout: 'pair' });
      expect(insertWidget(l, 'p', 'volume', 'v')).toBe(l);
    });
  });
});
