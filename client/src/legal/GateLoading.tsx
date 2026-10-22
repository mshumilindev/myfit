/** The loading page of the legal gate (signing in -> checking -> opening) (kit `FullPage` + `LoadingSteps`): first-run consent check and the moment after the agreement is recorded. */
import { SpotterMark } from '../brand/SpotterMark';
import { FullPage } from '../components/ui/FullPage';
import { LoadingSteps } from '../components/ui/LoadingSteps';
import { useGateT } from '../i18n/legalGate';
import type { ReactNode } from 'react';

export type LoadingStage = 'signin' | 'check' | 'record' | 'open';

/** The ladder follows what is really in flight: each stage is the request being waited for right now. */
export function GateLoading({
  stage,
  withRecord = false,
  detail,
  extra,
  aside,
}: {
  stage: LoadingStage;
  /** The agreement was just sent: the ladder has a "recording" step. */
  withRecord?: boolean;
  /** Replaces the current step's words ("Taking longer than usual…", "Waiting for the connection…"). */
  detail?: string;
  /** Under the card (a sign-out row when the check is slow). */
  extra?: ReactNode;
  aside?: ReactNode;
}) {
  const p = useGateT().page;
  const ids: LoadingStage[] = [
    'signin',
    'check',
    ...(withRecord ? (['record'] as const) : []),
    'open',
  ];
  const label: Record<LoadingStage, string> = {
    signin: p.loadSigningIn,
    check: p.loadChecking,
    record: p.loadRecording,
    open: p.loadOpening,
  };
  const done: Record<LoadingStage, string> = {
    signin: p.loadSignedIn,
    check: p.loadChecked,
    record: p.loadRecorded,
    open: p.loadOpening,
  };
  const at = ids.indexOf(stage);
  const steps = ids.map((id, i) => ({
    id,
    label: i < at ? done[id] : i === at && detail ? detail : label[id],
    state: i < at ? ('done' as const) : i === at ? ('active' as const) : ('todo' as const),
  }));
  return (
    <FullPage label={label[stage]} aside={aside}>
      <LoadingSteps
        brand={
          <>
            <SpotterMark size={44} variant="tight" />
            <span className="app-brand-word">spotter</span>
          </>
        }
        steps={steps}
        hint={p.loadHint}
      />
      {extra}
    </FullPage>
  );
}
