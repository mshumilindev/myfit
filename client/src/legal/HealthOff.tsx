/**
 * "X is off" (SPO-290): what a health screen shows without the feature's consent. Kit pieces only. `Turn on` opens the
 * consent prompt (`HealthConsentHost`). Nothing here reads or writes the feature's data.
 */
import type { ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHead } from '../components/ui/PageHead';
import { openHealthPrompt } from '../data/healthConsentGate';
import { useT } from '../i18n';
import { useHealthT } from '../i18n/healthConsent';
import type { HealthFeature } from './consents';
import { useAskHealthConsent, useHealthOn } from './useHealthConsent';

/** A whole area (a hub, a panel). */
export function HealthOffState({ feature }: { feature: HealthFeature }) {
  const { t } = useT();
  const h = useHealthT();
  return (
    <EmptyState
      icon="power"
      title={h.offTitle(t.privFeature[feature])}
      body={h.offBody}
      titleAs="h3"
    >
      <Button variant="secondary" onClick={() => openHealthPrompt(feature)}>
        {h.turnOn}
      </Button>
    </EmptyState>
  );
}

/**
 * The first screen of a health feature. On: the screen. Off: "X is off" with Turn on, and a person who was never asked
 * gets the consent prompt once, before anything is collected. While the records are not known yet nothing is shown
 * (no flash of "off" for someone who agreed). `onBack` makes it a full page with its own header; without it, a panel.
 */
export function HealthGate({
  feature,
  onBack,
  children,
}: {
  feature: HealthFeature;
  onBack?: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  const { on, ready } = useHealthOn(feature);
  useAskHealthConsent(feature);
  if (on) return <>{children}</>;
  const body = ready ? <HealthOffState feature={feature} /> : null;
  if (!onBack) return body;
  return (
    <div className="screen hl">
      <PageHead
        className="hl-pbar"
        back={{ label: t.backAction, onClick: onBack }}
        title={t.privFeature[feature]}
      />
      <div className="hl-scroll">
        <div className="hl-cnt">{body}</div>
      </div>
    </div>
  );
}
