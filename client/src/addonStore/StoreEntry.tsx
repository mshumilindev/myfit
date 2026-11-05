/**
 * What App.tsx needs from the Add-on Store (SPO-513), in one import: the address check, the hook that follows it,
 * and the lazy full-screen mode. Keeps App.tsx's footprint to a few lines.
 */
import { lazy, Suspense } from 'react';
import type { Role } from '../api';
import { AppRoot } from '../components/SpotterSky';
import { ScreenSkeleton } from '../components/ui/Skeletons';
import { useT } from '../i18n';

export { isStoreHash } from './storeRoute';
import { getRole } from '../api';
import { useStoreOpen } from './useStoreOpen';

export { useStoreOpen };

/** The signed-in role plus whether the store is open: one hook call in App.tsx. */
export function useRoleWithStore(authed: boolean): [Role, boolean] {
  const role = getRole();
  return [role, useStoreOpen(authed, role)];
}

const StoreApp = lazy(() => import('./StoreApp').then((module) => ({ default: module.StoreApp })));

export function StoreScreen({ role, onOpenProfile }: { role: Role; onOpenProfile: () => void }) {
  const { t } = useT();
  return (
    <AppRoot>
      <Suspense fallback={<ScreenSkeleton label={t.loadingApp} />}>
        <StoreApp role={role} onOpenProfile={onOpenProfile} />
      </Suspense>
    </AppRoot>
  );
}
