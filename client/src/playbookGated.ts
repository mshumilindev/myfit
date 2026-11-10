/**
 * Playbook is an add-on (owner 10.11: an uninstalled add-on counts for nothing anywhere). Every reader that is not a hook-gated
 * screen — Atlas, widgets, the session builder, the session summary — reads the playbook through here: with the add-on off it
 * is an empty, not-ready playbook, so no play, nudge or suggestion can leak. The history stays; the screens use `usePlaybookOn`.
 */
import { playbookAvailable } from './addons/featureGates';
import { computePlaybook, type PlaybookResult } from './playbook';
import type { Workout } from './types';

const OFF: PlaybookResult = { ready: false, plays: [], recent: [] };

export function computePlaybookGated(finished: Workout[], now: number): PlaybookResult {
  return playbookAvailable() ? computePlaybook(finished, now) : OFF;
}
