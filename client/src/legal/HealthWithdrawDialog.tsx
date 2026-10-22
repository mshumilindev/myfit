/**
 * Turning a health feature off (SPO-290), from the Consents page. Two parts, both from the approved design:
 *  1. "Turn off X?" (one step): the feature stops on this device at once, the withdrawal is recorded.
 *  2. If anything is stored for it, an OFFER (never forced) to delete it through the 2-step red-action prompt
 *     (`StepConfirmDialog`: "Delete your X data?" then "This cannot be undone"); "Keep my data" leaves it, unused.
 * The data is removed through the feature's own delete path (`healthData.ts`); nothing is faked.
 */
import { useState } from 'react';
import { StepConfirmDialog } from '../components/ui/StepConfirmDialog';
import { ConfirmDialog } from '../components/ui/Overlays';
import { useT } from '../i18n';
import { useHealthT, withdrawNote } from '../i18n/healthConsent';
import type { HealthFeature } from './consents';
import { withdrawHealth } from './healthConsentActions';
import { deleteHealthData, hasHealthData } from './healthData';
import { healthLook } from './healthFeatures';

export interface HealthWithdrawResult {
  /** The person confirmed turning it off. */
  confirmed: boolean;
  /** The withdrawal record is saved (the feature is off on this device either way). */
  saved: boolean;
  /** Deleting was asked for and failed. */
  deleteFailed: boolean;
}

export function HealthWithdrawDialog({
  feature,
  onDone,
}: {
  feature: HealthFeature;
  onDone: (r: HealthWithdrawResult) => void;
}) {
  const { t } = useT();
  const h = useHealthT();
  const [stage, setStage] = useState<'ask' | 'working' | 'delete'>('ask');
  const [saved, setSaved] = useState(true);
  const w = h.features[feature];
  const name = t.privFeature[feature];

  async function turnOff() {
    setStage('working');
    const ok = await withdrawHealth(feature);
    setSaved(ok);
    // Whether anything is stored is only a question for the offer; if it cannot be answered, nothing is offered.
    const present = await hasHealthData(feature).catch(() => false);
    if (present) setStage('delete');
    else onDone({ confirmed: true, saved: ok, deleteFailed: false });
  }

  async function remove() {
    let failed = false;
    try {
      await deleteHealthData(feature);
    } catch {
      failed = true;
    }
    onDone({ confirmed: true, saved, deleteFailed: failed });
  }

  if (stage === 'delete') {
    return (
      <StepConfirmDialog
        steps={[
          {
            id: 'ask',
            icon: 'warning',
            title: h.d1Title(name),
            body: w.limits ? `${h.d1Body} ${h.d1Limits}` : h.d1Body,
            confirmLabel: h.d1Confirm,
          },
          {
            id: 'sure',
            icon: 'trash',
            title: h.d2Title,
            body: h.d2Body,
            confirmLabel: h.d2Confirm,
          },
        ]}
        cancelLabel={h.dKeep}
        progressLabel={h.dProgress}
        onCancel={() => onDone({ confirmed: true, saved, deleteFailed: false })}
        onConfirm={() => void remove()}
      />
    );
  }
  if (stage === 'working') return null;
  return (
    <ConfirmDialog
      icon={healthLook(feature).icon}
      title={h.wTitle(w.name)}
      body={h.wBody(withdrawNote(w))}
      confirmLabel={h.wConfirm}
      cancelLabel={h.wKeep}
      onCancel={() => onDone({ confirmed: false, saved: true, deleteFailed: false })}
      onConfirm={() => void turnOff()}
    />
  );
}
