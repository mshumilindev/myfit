import { describe, expect, it } from 'vitest';
import { routeAddon } from './healthRoute';

describe('routeAddon: which Health module a link needs (SPO-500 hard guard)', () => {
  it('maps each module page and form to its add-on', () => {
    expect(routeAddon({ nic: 'hub' })).toBe('nicotine');
    expect(routeAddon({ alc: 'days' })).toBe('alcohol');
    expect(routeAddon({ sup: 'calc' })).toBe('supplements');
    expect(routeAddon({ cyc: 'hub' })).toBe('cycle');
    expect(routeAddon({ cond: 'new' })).toBe('conditions');
    expect(routeAddon({ form: { kind: 'new', ctx: 'start', type: 'injury' } })).toBe('injury-log');
    expect(routeAddon({ form: { kind: 'edit-injury', injuryId: 'i' } })).toBe('injury-log');
    expect(routeAddon({ form: { kind: 'new', ctx: 'past', type: 'illness' } })).toBe('unwell');
    expect(routeAddon({ form: { kind: 'new', ctx: 'start', type: 'off' } })).toBe('rest');
  });
  it('the overview and the history need no module', () => {
    expect(routeAddon({})).toBeNull();
  });
});
