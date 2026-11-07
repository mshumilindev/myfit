/** Category names for the store chips and the Discover tile. */
import type { AddonStoreStrings } from '../i18n/addonStore';

export function catLabel(st: AddonStoreStrings, c: string): string {
  return st[`cat${c[0].toUpperCase()}${c.slice(1)}` as 'catRecovery'];
}
