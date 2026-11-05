import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref, enableAddons } from './enabledSet';
import {
  addonsQueuePref,
  installQueue,
  queueAdd,
  queueClear,
  queueRemove,
  resolveQueue,
} from './queue';

beforeEach(() => {
  addonsPref.reset();
  addonsQueuePref.reset();
});

describe('selected list', () => {
  it('picking an add-on picks its app too', () => {
    queueAdd(['injury-log'], 'member');
    expect(addonsQueuePref.get()).toEqual(['health', 'injury-log']);
  });
  it('is idempotent and ignores what a role may not use', () => {
    queueAdd(['sleep', 'sleep'], 'member');
    queueAdd(['nutrition', 'nope'], 'member');
    expect(addonsQueuePref.get()).toEqual(['sleep']);
  });
  it('un-picking an app takes its picked add-ons with it', () => {
    queueAdd(['injury-log', 'cycle', 'sleep'], 'member');
    queueRemove(['health'], 'member');
    expect(addonsQueuePref.get()).toEqual(['sleep']);
  });
  it('does not queue what is already installed', () => {
    enableAddons(['health'], 'member');
    queueAdd(['health', 'cycle'], 'member');
    expect(addonsQueuePref.get()).toEqual(['cycle']);
    expect(resolveQueue(['health', 'cycle'], new Set(['health']), 'member')).toEqual(['cycle']);
  });
  it('installing turns the picked items on and empties the list', () => {
    queueAdd(['cycle', 'sleep'], 'member');
    expect(installQueue('member')).toEqual(['health', 'cycle', 'sleep']);
    expect(addonsQueuePref.get()).toEqual([]);
    expect([...addonsPref.get()].sort()).toEqual(['cycle', 'health', 'sleep']);
    expect(installQueue('member')).toEqual([]);
  });
  it('clears', () => {
    queueAdd(['sleep'], 'member');
    queueClear();
    expect(addonsQueuePref.get()).toEqual([]);
  });
});
