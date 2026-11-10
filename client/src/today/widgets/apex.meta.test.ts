import { describe, expect, it } from 'vitest';
import { APEX_WIDGETS } from './apex';
import { APEX_WIDGET_META } from './apex.meta';

describe('apex widget metadata', () => {
  it('matches the widgets in apex.tsx (id, group, icon, tone, name)', () => {
    expect(APEX_WIDGET_META.map((m) => m.id)).toEqual(APEX_WIDGETS.map((w) => w.id));
    for (const w of APEX_WIDGETS) {
      const m = APEX_WIDGET_META.find((x) => x.id === w.id)!;
      expect([m.group, m.icon, m.tone]).toEqual([w.group, w.icon, w.tone]);
      const tw = { streak: 'Streak' } as never;
      expect(m.name(tw)).toBe(w.name(tw));
    }
  });
});
