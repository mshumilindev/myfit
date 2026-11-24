import { afterEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { tipsNow } from './appTips';

afterEach(() => addonsPref.reset());

const all = () =>
  tipsNow()
    .map((t) => t.text.join(' '))
    .join(' ');

describe('app tips of Advanced training modules', () => {
  it('say nothing of supersets, drop sets or equipment while those modules are off', () => {
    addonsPref.set([]);
    const text = all().toLowerCase();
    expect(text).not.toMatch(/superset|суперсет|dropset|дроп|equipment|обладнання/);
    expect(tipsNow().some((t) => t.about === 'app_gyms')).toBe(true);
  });
  it('tell them in full once installed', () => {
    addonsPref.set(['supersets', 'set-types', 'equipment']);
    const text = all().toLowerCase();
    expect(text).toMatch(/superset/);
    expect(text).toMatch(/dropset/);
    expect(text).toMatch(/equipment/);
  });
});
