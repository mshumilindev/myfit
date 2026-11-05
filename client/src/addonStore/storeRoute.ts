/**
 * Add-on Store routes (SPO-513): `#/store` (Discover), `#/store/browse`, `#/store/installed`.
 * Pure parsing; the hook that follows the address is in `useStoreOpen.ts`.
 */
export type StoreTab = 'discover' | 'browse' | 'installed';
export const STORE_TABS: readonly StoreTab[] = ['discover', 'browse', 'installed'];

function segments(hash: string): string[] {
  return hash
    .split('?')[0]
    .replace(/^#?\/?/, '')
    .split('/');
}

export function isStoreHash(hash: string): boolean {
  return segments(hash)[0] === 'store';
}

/** The tab a store address names; an unknown or missing second segment is Discover. */
export function storeTabFromHash(hash: string): StoreTab {
  const seg = segments(hash)[1] ?? '';
  return seg === 'browse' || seg === 'installed' ? seg : 'discover';
}

export function storeHash(tab: StoreTab): string {
  return tab === 'discover' ? '#/store' : `#/store/${tab}`;
}

/** Where a person without a store (manager) lands instead. */
export const STORE_FALLBACK_HASH = '#/today';
