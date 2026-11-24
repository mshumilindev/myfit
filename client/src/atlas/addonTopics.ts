/**
 * Atlas topics that belong to an add-on of Advanced training. While the add-on is off Atlas answers as if it did not know the
 * topic (the question falls through like any unknown one): it must not describe, name or suggest a tool the person does not have.
 * Knowledge about the training itself (what a circuit or an RPE is in general) is not listed here; only topics that explain how
 * the app's own tool works, or are about it by name.
 */
import { addonAvailable } from '../addons/enabledSet';
import { PLAIN_ANSWERS } from './plainAnswers';

/** Intent id → the add-on that has to be installed for Atlas to answer it. */
export const TOPIC_ADDON: Readonly<Record<string, string>> = {
  app_superset: 'supersets',
  superset: 'supersets',
  dropset: 'set-types',
  rpe: 'effort',
  machines_free: 'equipment',
};

/** Is this intent allowed to answer now? Unlisted topics always are. Never throws. */
export function topicShown(id: string): boolean {
  const addon = TOPIC_ADDON[id];
  if (!addon) return true;
  try {
    return addonAvailable(addon);
  } catch {
    return false;
  }
}

/** What a topic that only MENTIONS an add-on says while that add-on is off (the same topic, told without the add-on's part). */
export interface PlainAnswer {
  addon: string;
  answer: [string, string];
}

/** The answer as told now: the plain form while the add-on it mentions is off. */
export function answerNow(id: string, answer: [string, string]): [string, string] {
  const plain = PLAIN_ANSWERS[id];
  if (!plain) return answer;
  try {
    return addonAvailable(plain.addon) ? answer : plain.answer;
  } catch {
    return plain.answer;
  }
}
