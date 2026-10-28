/** Types of the browser-storage key registry (SPO-390); the entries live in localKeys.registry.part*.ts. */
export type LocalKeyClass = 'synced' | 'gap' | 'ephemeral' | 'diag';
export interface LocalKeyEntry {
  key?: string;
  prefix?: string;
  scope: 'device' | 'account';
  class: LocalKeyClass;
  wipe: 'signout' | 'keep';
  syncedTo?: string;
  issue?: string;
  note: string;
}
