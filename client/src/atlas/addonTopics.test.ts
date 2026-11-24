import { afterEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { ALL_INTENTS } from './intents';
import { APP_TOPICS } from './appTopics';
import { APP_TOPICS_MORE } from './appTips';
import { PLAIN_ANSWERS } from './plainAnswers';
import { answerNow, TOPIC_ADDON, topicShown } from './addonTopics';

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
  it('topics that only mention a module are told without it while it is off', () => {
    expect(Object.keys(PLAIN_ANSWERS).sort()).toEqual(['app_gyms', 'app_tour', 'app_warmup_set']);
    const all = [...APP_TOPICS, ...APP_TOPICS_MORE];
    for (const id of Object.keys(PLAIN_ANSWERS)) {
      const t = all.find((x) => x.id === id)!;
      const plain = PLAIN_ANSWERS[id];
      addonsPref.set([]);
      const off = answerNow(t.id, t.answer);
      addonsPref.set([plain.addon]);
      const on = answerNow(t.id, t.answer);
      expect(off).toEqual(plain.answer);
      expect(on).toEqual(t.answer);
      expect(off[0]).not.toMatch(/Inventory|Dropset|equipment/);
    }
  });
});
