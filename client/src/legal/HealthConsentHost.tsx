/**
 * Health-feature consent (SPO-290). Mounted once, next to the app (main.tsx), like `GeoConsentHost`.
 *  - Keeps `data/healthConsentGate` in step with the person's records: a feature is on = `optionalConsentOn(records,
 *    'health:<f>')`. Until the records are known every feature is off (fail closed): nothing is written or shown.
 *  - Renders the consent prompt of the feature something asked for (`openHealthPrompt(f)`). "I agree" records the grant
 *    for the feature's categories; "Not now" and dismissing record nothing.
 */
import { useEffect, useState } from 'react';
import { ConsentPrompt } from '../components/ui/ConsentPrompt';
import { LegalLinks } from '../components/ui/LegalLinks';
import { Notice } from '../components/ui/Notice';
import {
  closeHealthPrompt,
  setHealthConsentState,
  settleHealthLocally,
  withdrawHealthLocally,
  type HealthOnMap,
} from '../data/healthConsentGate';
import { useHealthT, withdrawNote } from '../i18n/healthConsent';
import { useLegalT } from '../i18n/legal';
import { currentUid } from '../api';
import { useConsentRecords } from './consentApi';
import {
  HEALTH_FEATURES,
  consentState,
  currentVersion,
  optionalConsentOn,
  type HealthFeature,
} from './consents';
import { grantHealth } from './healthConsentActions';
import { healthLook } from './healthFeatures';
import { localOffKinds } from './localOff';
import { useHealthPromptFeature } from './useHealthConsent';

function HealthConsentSync() {
  const { records, confirmed } = useConsentRecords();
  useEffect(() => {
    const on = {} as Record<HealthFeature, boolean>;
    const answered = {} as Record<HealthFeature, boolean>;
    const stopped = localOffKinds(currentUid());
    for (const f of HEALTH_FEATURES) {
      const kind = `health:${f}` as const;
      on[f] = optionalConsentOn(records, kind);
      answered[f] = consentState(records, kind) !== 'none';
      // A withdrawal made on this device that the server may not have yet (kept across a reload) keeps the feature off.
      if (stopped.includes(kind)) withdrawHealthLocally(f);
      // The server has the withdrawal now: the device-side stop is no longer needed.
      else if (consentState(records, kind) !== 'granted') settleHealthLocally(f);
    }
    setHealthConsentState({
      on: on as HealthOnMap,
      answered,
      ready: confirmed || records.length > 0,
    });
  }, [records, confirmed]);
  return null;
}

function HealthConsentPrompt({ feature }: { feature: HealthFeature }) {
  const h = useHealthT();
  const { lg } = useLegalT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const w = h.features[feature];
  const look = healthLook(feature);
  const nutrition = feature === 'nutrition';

  async function accept() {
    setBusy(true);
    setFailed(false);
    const ok = await grantHealth(feature);
    setBusy(false);
    if (ok) closeHealthPrompt();
    else setFailed(true);
  }

  return (
    <ConsentPrompt
      icon={look.icon}
      tone={look.tone}
      title={w.title}
      lead={h.lead}
      factsLabel={h.factsLabel}
      facts={[
        { icon: 'chat-circle', label: h.whatLabel, sub: w.what },
        {
          icon: 'lock-simple',
          label: h.whereLabel,
          sub: nutrition ? h.whereNutrition : h.where,
          ...(nutrition && { tone: 'injury' as const }),
        },
        { icon: 'user-circle', label: h.whoLabel, sub: w.who },
        ...(nutrition
          ? [
              {
                icon: 'shield-warning',
                label: h.outsideLabel,
                sub: h.outsideNutrition,
                tone: 'injury' as const,
              },
            ]
          : []),
        {
          icon: 'arrow-counter-clockwise',
          label: h.withdrawLabel,
          sub: h.withdraw(withdrawNote(w)),
        },
      ]}
      before={
        failed ? (
          <Notice tone="danger" icon="warning-circle">
            {h.saveError}
          </Notice>
        ) : undefined
      }
      primary={h.primary}
      primaryDisabled={busy}
      secondary={h.secondary}
      closeLabel={h.close}
      foot={
        <>
          <LegalLinks
            label={lg.ui.legalNav}
            privacyLabel={lg.ui.privacyLink}
            termsLabel={lg.ui.termsLink}
          />
          <span className="ut-xs ut-faint">{h.version(currentVersion(`health:${feature}`))}</span>
        </>
      }
      onPrimary={() => void accept()}
      onSecondary={() => closeHealthPrompt(true)}
    />
  );
}

export function HealthConsentHost() {
  const feature = useHealthPromptFeature();
  return (
    <>
      <HealthConsentSync />
      {feature && <HealthConsentPrompt key={feature} feature={feature} />}
    </>
  );
}
