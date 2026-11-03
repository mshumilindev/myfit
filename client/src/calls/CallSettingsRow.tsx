import { lazy, Suspense, useState } from 'react';
import { ListRow } from '../components/ui/GroupedList';
import { useCallsT } from '../i18n/calls';
import { Icon } from '../ui';
import { useCallsPublished } from './callsStore';

/** The drawer (media code) loads only when it is opened, so Profile stays light. */
const CallSettingsSheet = lazy(() =>
  import('./CallSettingsSheet').then((m) => ({ default: m.CallSettingsSheet })),
);

/** Profile → Settings → "Calls" row (SPO-446). Drawn only while calls are switched on for this person. */
export function CallSettingsRow() {
  const { cl } = useCallsT();
  const { enabled } = useCallsPublished();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <ListRow
        icon={<Icon name="video-camera" />}
        label={cl.callSetRow}
        sub={cl.callSetRowSub}
        chevron
        onClick={() => setOpen(true)}
      />
      {open && (
        <Suspense fallback={null}>
          <CallSettingsSheet onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
