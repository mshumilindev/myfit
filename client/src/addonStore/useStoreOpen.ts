/**
 * Follows the address for the Add-on Store (SPO-513): is `#/store…` open for this person? A role with no store
 * (manager) is sent to Today instead. App.tsx only calls this and renders the store when it returns true.
 */
import { useEffect, useState } from 'react';
import type { Role } from '../api';
import { currentHash, setHash } from '../route';
import { hasStore } from './storeCatalog';
import { isStoreHash, STORE_FALLBACK_HASH } from './storeRoute';

export function useStoreOpen(authed: boolean, role: Role): boolean {
  const [wanted, setWanted] = useState<boolean>(() => isStoreHash(currentHash()));
  useEffect(() => {
    const on = () => setWanted(isStoreHash(currentHash()));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const allowed = hasStore(role);
  useEffect(() => {
    if (authed && wanted && !allowed) setHash(STORE_FALLBACK_HASH, true);
  }, [authed, wanted, allowed]);
  return authed && wanted && allowed;
}
