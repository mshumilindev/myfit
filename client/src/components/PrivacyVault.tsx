/**
 * Privacy & encryption status. There is nothing to set up: the data key comes from the
 * server for the signed-in account, existing data is sealed in the background, and coach
 * access is exchanged automatically. This block only says what is going on.
 * Shown in Profile → Settings (own profile) while the `conditions` flag is on.
 */
import { useSyncExternalStore } from 'react';
import { GroupedList, ListRow } from './ui/GroupedList';
import { IconTile } from './ui/IconTile';
import { useT } from '../i18n';
import { vault } from '../vaultIO';

export function PrivacyVault() {
  const { t } = useT();
  const status = useSyncExternalStore(vault.subscribe, vault.status);
  if (status === 'unknown') return null;
  const ready = status === 'ready';
  return (
    <GroupedList header={t.vaultTitle}>
      <ListRow
        icon={<IconTile tone="chronic" size={30} icon={ready ? 'shield-check' : 'lock-open'} />}
        label={ready ? t.vaultOnTitle : t.vaultPendingTitle}
        sub={ready ? t.vaultOnBody : t.vaultPendingBody}
      />
      {ready && <ListRow label={t.vaultCoachNote} dim />}
    </GroupedList>
  );
}
