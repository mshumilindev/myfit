import { useState } from 'react';
import { useT } from '../i18n';
import { Icon } from '../ui';
import { ListRow } from './ui/GroupedList';
import { SessionsSheet } from './SessionsSheet';

/** Profile → Settings → "Sessions" row; opens the devices sheet (SPO-212). */
export function SessionsRow() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListRow
        icon={<Icon name="devices" />}
        label={t.sessionsRow}
        chevron
        onClick={() => setOpen(true)}
      />
      {open && <SessionsSheet onClose={() => setOpen(false)} />}
    </>
  );
}
