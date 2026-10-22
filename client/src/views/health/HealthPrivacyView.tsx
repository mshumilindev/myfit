/**
 * Health › Privacy and sharing: the one place for everything privacy in Health. One list (`ClientTrainerSharing`) holds all
 * ten sharing settings in three groups with one summary on top and one "Stop sharing" (SPO-107); below it the destructive
 * "delete nicotine / alcohol / supplement / cycle data" rows sit behind a danger confirm with the universal encryption
 * note as the group footer. Sharing applies at once (like the other settings screens). Kit primitives only.
 */
import { useState } from 'react';
import { PageHead } from '../../components/ui/PageHead';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { ConfirmDialog } from '../../components/ui/Overlays';
import { useT } from '../../i18n';
import { ClientTrainerSharing } from '../../coach/client/lazy';
import {
  deleteAlcoholData,
  deleteCycleData,
  deleteNicotineData,
  useCycle,
  deleteSupplementData,
} from '../../store';
import { setHash } from '../../route';

export interface HealthPrivacyViewProps {
  onBack: () => void;
}

export function HealthPrivacyView({ onBack }: HealthPrivacyViewProps) {
  const { t } = useT();
  const cycleOn = useCycle().enabled;
  const [confirmCycle, setConfirmCycle] = useState(false);
  const [confirm, setConfirm] = useState<'nicotine' | 'alcohol' | 'supplements' | null>(null);

  return (
    <div className="screen hl">
      <PageHead
        className="hl-pbar"
        back={{ label: t.backAction, onClick: onBack }}
        title={t.hlPrivRow}
      />
      <div className="hl-scroll">
        <div className="hl-cnt">
          <ClientTrainerSharing
            onOpenLog={() => {
              setHash('#/trainer/log');
            }}
            onOpenTrainer={() => {
              setHash('#/trainer');
            }}
          />
          <GroupedList header={t.nicPrivData} footer={t.hlPrivNote}>
            <ListRow
              action
              tone="danger"
              label={t.nicPrivDelete}
              onClick={() => setConfirm('nicotine')}
            />
            <ListRow
              action
              tone="danger"
              label={t.alcPrivDelete}
              onClick={() => setConfirm('alcohol')}
            />
            <ListRow
              action
              tone="danger"
              label={t.supPrivDelete}
              onClick={() => setConfirm('supplements')}
            />
            {cycleOn && (
              <ListRow
                action
                tone="danger"
                label={t.cycDelete}
                onClick={() => setConfirmCycle(true)}
              />
            )}
          </GroupedList>
        </div>
      </div>
      {confirmCycle && (
        <ConfirmDialog
          title={t.cycDeleteTitle}
          body={t.cycDeleteBody}
          confirmLabel={t.cycDeleteConfirm}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirmCycle(false)}
          onConfirm={() => {
            deleteCycleData();
            setConfirmCycle(false);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === 'supplements'
              ? t.supPrivDeleteAsk
              : confirm === 'alcohol'
                ? t.alcPrivDeleteAsk
                : t.nicPrivDeleteAsk
          }
          body={
            confirm === 'supplements'
              ? t.supPrivDeleteBody
              : confirm === 'alcohol'
                ? t.alcPrivDeleteBody
                : t.nicPrivDeleteBody
          }
          confirmLabel={
            confirm === 'supplements'
              ? t.supPrivDelete
              : confirm === 'alcohol'
                ? t.alcPrivDelete
                : t.nicPrivDelete
          }
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === 'supplements') deleteSupplementData();
            else if (confirm === 'alcohol') deleteAlcoholData();
            else deleteNicotineData();
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
