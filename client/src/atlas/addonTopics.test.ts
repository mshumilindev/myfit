import { afterEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { ALL_INTENTS } from './intents';
import { TOPIC_ADDON, topicShown } from './addonTopics';

afterEach(() => addonsPref.reset());

describe('Atlas topics of Advanced training modules', () => {
  it('are not answered while their module is off, and come back when it is installed', () => {
    addonsPref.set([]);
    const off = new Set(ALL_INTENTS().map((i) => i.id));
    for (const id of Object.keys(TOPIC_ADDON)) {
      expect(topicShown(id)).toBe(false);
      expect(off.has(id)).toBe(false);
    }
    addonsPref.set(Object.values(TOPIC_ADDON));
    const on = new Set(ALL_INTENTS().map((i) => i.id));
    for (const id of Object.keys(TOPIC_ADDON)) expect(on.has(id)).toBe(true);
  });
  it('every gated id is a real intent', () => {
    addonsPref.set(Object.values(TOPIC_ADDON));
    const ids = new Set(ALL_INTENTS().map((i) => i.id));
    for (const id of Object.keys(TOPIC_ADDON)) expect(ids.has(id)).toBe(true);
  });
});
