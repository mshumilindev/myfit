/**
 * Flag-gated lazy doors into `coach/client` for the real app (Gym bundle stays free of coach code). Each wrapper renders
 * nothing unless the `coach` flag is on; the chunk loads only then.
 */
import { lazy, Suspense, type ComponentProps } from 'react';
import { useClientCoachEnabled } from './gate';

const Bridge = lazy(() => import('./ClientBridge').then((m) => ({ default: m.ClientBridge })));
const Sharing = lazy(() =>
  import('./screens/TrainerSharing').then((m) => ({ default: m.TrainerSharing })),
);
const TodayX = lazy(() => import('./ClientExtras').then((m) => ({ default: m.ClientTodayExtras })));
const ProgX = lazy(() =>
  import('./ClientExtras').then((m) => ({ default: m.ClientProgramExtras })),
);
const Target = lazy(() => import('./ClientExtras').then((m) => ({ default: m.ClientTargetStrip })));
const DayTag = lazy(() =>
  import('./ClientExtras').then((m) => ({ default: m.ClientTrainerDayTag })),
);
export const ClientRoutesLazy = lazy(() => import('./ClientRoutes'));

export function ClientBridgeLazy() {
  return useClientCoachEnabled() ? (
    <Suspense fallback={null}>
      <Bridge />
    </Suspense>
  ) : null;
}
/**
 * The one sharing list of Privacy and sharing. NOT flag-gated here: the four on-device settings are listed with or without
 * the coach feature; `TrainerSharing` itself adds the trainer block and the grant rows only when the flag is on.
 */
export function ClientTrainerSharing(p: ComponentProps<typeof Sharing>) {
  return (
    <Suspense fallback={null}>
      <Sharing {...p} />
    </Suspense>
  );
}
export function ClientTodayExtrasLazy() {
  return useClientCoachEnabled() ? (
    <Suspense fallback={null}>
      <TodayX />
    </Suspense>
  ) : null;
}
export function ClientProgramExtrasLazy() {
  return useClientCoachEnabled() ? (
    <Suspense fallback={null}>
      <ProgX />
    </Suspense>
  ) : null;
}
export function ClientTargetStripLazy(p: { exName: string; planItemId?: string }) {
  return useClientCoachEnabled() ? (
    <Suspense fallback={null}>
      <Target {...p} />
    </Suspense>
  ) : null;
}
export function ClientTrainerDayTagLazy(p: { dow: number }) {
  return useClientCoachEnabled() ? (
    <Suspense fallback={null}>
      <DayTag {...p} />
    </Suspense>
  ) : null;
}
