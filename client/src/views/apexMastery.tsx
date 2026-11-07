/** What the Apex shell needs for its Mastery module: the screen and the rail entry, only while the module is on.
 * The caller supplies the lazy renderers so this file never imports App (no import cycle). */
import type { ReactNode } from 'react';
import { masteryRailItem } from '../components/suite/masteryRailItem';

export function apexMastery(
  on: boolean,
  label: string,
  go: (tab: 'home' | 'mastery') => void,
  renderView: () => ReactNode,
  renderBadge: () => ReactNode,
) {
  if (!on) return {};
  return {
    mastery: renderView(),
    masteryRail: masteryRailItem(label, () => go('mastery'), renderBadge()),
  };
}
