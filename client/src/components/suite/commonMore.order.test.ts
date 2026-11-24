import { describe, expect, it } from 'vitest';
import type { MoreMenuItem } from '../ui/MoreMenu';
import { orderMoreItems } from './commonMore';

const item = (id: string): MoreMenuItem => ({
  id,
  icon: 'x',
  label: id,
  onSelect: () => undefined,
});
const ids = (xs: MoreMenuItem[]) => xs.map((x) => x.id);

describe('order of the More menu', () => {
  const common = ['addons', 'themes', 'planner', 'maxes', 'privacy', 'language'].map(item);

  it('Planner first, Maxes right under it, then the rest, settings last', () => {
    expect(ids(orderMoreItems(common, []))).toEqual([
      'planner',
      'maxes',
      'addons',
      'themes',
      'privacy',
      'language',
    ]);
  });

  it('the app’s own pages come after Maxes and before the settings rows', () => {
    expect(ids(orderMoreItems(common, [item('history'), item('settings')]))).toEqual([
      'planner',
      'maxes',
      'history',
      'addons',
      'themes',
      'settings',
      'privacy',
      'language',
    ]);
  });

  it('without Planner, Maxes leads; without Maxes nothing changes', () => {
    expect(
      ids(
        orderMoreItems(
          common.filter((i) => i.id !== 'planner'),
          [],
        ),
      )[0],
    ).toBe('maxes');
    expect(
      ids(
        orderMoreItems(
          common.filter((i) => i.id !== 'maxes'),
          [],
        ),
      ),
    ).toEqual(['planner', 'addons', 'themes', 'privacy', 'language']);
  });
});
