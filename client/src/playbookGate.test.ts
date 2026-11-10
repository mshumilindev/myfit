import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref, disableAddons } from './addons/enabledSet';
import { computePlaybook } from './playbook';

describe('computePlaybook and the Playbook add-on', () => {
  beforeEach(() => addonsPref.reset());
  it('is an empty, not-ready playbook while the add-on is not installed', () => {
    disableAddons(['playbook'], 'member');
    expect(computePlaybook([], Date.now())).toEqual({ ready: false, plays: [], recent: [] });
  });
});
