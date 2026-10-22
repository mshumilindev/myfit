/**
 * Delete one health feature's stored data from its data page (SPO-295 N5): the existing two-step red prompt of the
 * withdraw flow (`HealthWithdrawDialog`, SPO-290) with the same words, through the feature's own delete path
 * (`healthData.ts`). Works whether the feature is on or off; the consent is not touched.
 */
import { StepConfirmDialog } from '../../components/ui/StepConfirmDialog';
import { useT } from '../../i18n';
import { useHealthT } from '../../i18n/healthConsent';
import type { HealthFeature } from '../consents';
import { deleteHealthData } from '../healthData';

export function HealthDeleteDialog({
  feature,
  onDone,
}: {
  feature: HealthFeature;
  onDone: (r: { deleted: boolean; failed: boolean }) => void;
}) {
  const { t } = useT();
  const h = useHealthT();
  async function remove() {
    let failed = false;
    try {
      await deleteHealthData(feature);
    } catch {
      failed = true;
    }
    onDone({ deleted: !failed, failed });
  }
  return (
    <StepConfirmDialog
      steps={[
        {
          id: 'ask',
          icon: 'warning',
          title: h.d1Title(t.privFeature[feature]),
          body: h.d1Body,
          confirmLabel: h.d1Confirm,
        },
        { id: 'sure', icon: 'trash', title: h.d2Title, body: h.d2Body, confirmLabel: h.d2Confirm },
      ]}
      cancelLabel={h.dKeep}
      progressLabel={h.dProgress}
      onCancel={() => onDone({ deleted: false, failed: false })}
      onConfirm={() => void remove()}
    />
  );
}
