/**
 * Add-on Store routes: `#/store` (Discover), `#/store/apps`, `#/store/addons`, `#/store/selected`,
 * `#/store/installed`, `#/store/search`, `#/store/installing`, `#/store/done`, `#/store/item/<id>`, `#/store/manage/<id>`. Pure parsing; the hook that follows the address is
 * in `useStoreOpen.ts`.
 */
export type StoreTab = 'discover' | 'apps' | 'addons' | 'selected' | 'installed';
export const STORE_TABS: readonly StoreTab[] = [
  'discover',
  'apps',
  'addons',
  'selected',
  'installed',
];

/** Places with no tab: search, the install run (installing → done) and an item page. */
export type StoreOff = 'search' | 'installing' | 'done';
export type StoreView = { view: StoreTab | StoreOff } | { view: 'item' | 'manage'; id: string };

function segments(hash: string): string[] {
  return hash
    .split('?')[0]
    .replace(/^#?\/?/, '')
    .split('/');
}

export function isStoreHash(hash: string): boolean {
  return segments(hash)[0] === 'store';
}

export function parseStoreHash(hash: string): StoreView {
  const [, a, b] = segments(hash);
  if ((a === 'item' || a === 'manage') && b) return { view: a, id: decodeURIComponent(b) };
  if (a === 'search' || a === 'installing' || a === 'done') return { view: a };
  if (a === 'browse') return { view: 'apps' }; // the old Browse tab
  return {
    view: (STORE_TABS as readonly string[]).includes(a ?? '') ? (a as StoreTab) : 'discover',
  };
}

/** The tab a view belongs to (an item page and search belong to none). */
export function storeTabFromHash(hash: string): StoreTab | null {
  const v = parseStoreHash(hash);
  return v.view === 'item' ||
    v.view === 'manage' ||
    v.view === 'search' ||
    v.view === 'installing' ||
    v.view === 'done'
    ? null
    : v.view;
}

export function storeHash(v: StoreView['view'], id?: string): string {
  if (v === 'discover') return '#/store';
  if (v === 'item' || v === 'manage') return `#/store/${v}/${encodeURIComponent(id ?? '')}`;
  return `#/store/${v}`;
}

/** Where a person without a store (manager) lands instead. */
export const STORE_FALLBACK_HASH = '#/today';
