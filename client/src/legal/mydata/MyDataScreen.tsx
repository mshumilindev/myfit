/**
 * "What Spotter knows about you" as a screen of its own (SPO-295 N5), like the Consents page: `page` replaces the host view
 * while open (return it early), `open` shows it. The overview opens a data page per area; "Stored on this device" and
 * "Consent history" have their own pages. All numbers are read from the live stores here and passed down as plain inputs.
 */
import { useState, type ReactNode } from 'react';
import { useChatLog } from '../../atlas/chatLog';
import { pushState } from '../../push';
import { hasStoredHealthData, useSelfTrainerId, useStore } from '../../store';
import { hasCurrentConsent } from '../consents';
import { useConsentRecords } from '../consentApi';
import { DeleteAccountFlow } from '../DeleteAccountFlow';
import { ExportPage } from '../export/ExportPage';
import { AreaPage } from './AreaPage';
import { inputsFromState, type AreaId, type AreaInputs } from './areas';
import { ConsentHistoryPage } from './ConsentHistoryPage';
import { DevicePage } from './DevicePage';
import { MyDataOverview } from './MyDataOverview';

function pushIsOn(): boolean | null {
  try {
    const s = pushState();
    return s === 'on' ? true : s === 'off' || s === 'denied' ? false : null;
  } catch {
    return null;
  }
}

/** The page inputs from the live stores. Hooks only: call it before any early return. */
function useAreaInputs(): AreaInputs {
  const s = useStore();
  const chat = useChatLog().length;
  const { records } = useConsentRecords();
  const trainerId = useSelfTrainerId();
  return inputsFromState(s, {
    stored: {
      cycle: hasStoredHealthData('cycle'),
      nicotine: hasStoredHealthData('nicotine'),
      alcohol: hasStoredHealthData('alcohol'),
      supplements: hasStoredHealthData('supplements'),
    },
    chat,
    atlasAllowed: hasCurrentConsent(records, 'atlas-ai'),
    geoAllowed: hasCurrentConsent(records, 'geo-search'),
    hasTrainer: !!trainerId,
    pushOn: pushIsOn(),
  });
}

export interface MyDataScreenProps {
  onBack: () => void;
  /** Opens Privacy and sharing (Health > Privacy and sharing). Absent = the row is not shown. */
  onOpenSharing?: () => void;
  /** Open on the data copy. */
  startAt?: 'export';
  /** The copy was asked for before deleting the account: its ready page offers to go on to the deletion. */
  thenDelete?: boolean;
}

export function MyDataScreen({ onBack, onOpenSharing, startAt, thenDelete }: MyDataScreenProps) {
  const [area, setArea] = useState<AreaId | null>(null);
  const [exporting, setExporting] = useState(startAt === 'export');
  const [deleting, setDeleting] = useState(false);
  const inputs = useAreaInputs();
  const { records, confirmed, error } = useConsentRecords();
  // The copy gets the consent history only once the server confirmed it: an empty list while loading would look like
  // "no consents" in consents.json. `null` makes the manifest say it was not loaded.
  const exportable = confirmed && !error ? records : null;
  const back = () => setArea(null);
  const del = () => setDeleting(true);
  let body: ReactNode;
  if (exporting)
    body = (
      <ExportPage
        onBack={() => setExporting(false)}
        consents={exportable}
        hasTrainer={inputs.hasTrainer}
        onContinueDelete={
          thenDelete
            ? () => {
                setExporting(false);
                setDeleting(true);
              }
            : undefined
        }
      />
    );
  else if (area === 'device') body = <DevicePage onBack={back} chat={inputs.chat} />;
  else if (area === 'consents') body = <ConsentHistoryPage records={records} onBack={back} />;
  else if (area)
    body = (
      <AreaPage
        area={area}
        inputs={inputs}
        onBack={back}
        onOpenSharing={onOpenSharing}
        onDeleteAccount={del}
      />
    );
  else
    body = (
      <MyDataOverview
        onBack={onBack}
        onOpen={setArea}
        onExport={() => setExporting(true)}
        onDeleteAccount={del}
      />
    );
  return (
    <>
      {body}
      {deleting && (
        <DeleteAccountFlow
          onCancel={() => setDeleting(false)}
          onDownloadCopy={() => {
            setDeleting(false);
            setExporting(true);
          }}
        />
      )}
    </>
  );
}

export function useMyDataPage(onOpenSharing?: () => void): {
  page: ReactNode;
  open: () => void;
  /** Opens straight on the data copy; `thenDelete` = it is the "copy first" step of the account deletion. */
  openExport: (thenDelete?: boolean) => void;
} {
  const [on, setOn] = useState<null | { export: boolean; thenDelete: boolean }>(null);
  return {
    page: on ? (
      <MyDataScreen
        onBack={() => setOn(null)}
        onOpenSharing={onOpenSharing}
        startAt={on.export ? 'export' : undefined}
        thenDelete={on.thenDelete}
      />
    ) : null,
    open: () => setOn({ export: false, thenDelete: false }),
    openExport: (thenDelete = false) => setOn({ export: true, thenDelete }),
  };
}
