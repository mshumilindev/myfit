import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref, disableAddons } from './addons/enabledSet';
import { computePlaybookGated } from './playbookGated';
import { computePlaybook } from './playbook';

describe('computePlaybookGated', () => {
  beforeEach(() => addonsPref.reset());
  it('is an empty, not-ready playbook while the Playbook add-on is not installed', () => {
    disableAddons(['playbook'], 'member');
    expect(computePlaybookGated([], Date.now())).toEqual({ ready: false, plays: [], recent: [] });
  });
  it('is the real playbook once installed', () => {
    addonsPref.set({ list: ['playbook'], updatedAt: 1 } as never);
    expect(computePlaybookGated([], 1)).toEqual(computePlaybook([], 1));
  });
});
