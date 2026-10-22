/**
 * Stored on this device (SPO-295 N7): what Spotter keeps in this browser, computed from what is really there
 * (`deviceInventory.ts`), and "Clear this device".
 *
 * The clear action: deviceWipe.ts has no wipe that leaves the person signed in (its sign-out wipe deletes the cached key and
 * the sealed stores, and the unwipe-able Firestore cache cannot be cleared while the SDK runs), so the honest action is the
 * existing sign-out with `forget`: it runs `afterSignOut` + `wipeAfterSignOut` and reloads. The prompt says so, and that
 * anything not yet synced is discarded (the wipe does not wait for pending writes). It runs only after the confirm.
 */
import { useEffect, useState } from 'react';
import { signOut } from '../../api';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { Hint } from '../../components/ui/Hint';
import { ConfirmDialog } from '../../components/ui/Overlays';
import { useT } from '../../i18n';
import { useMyDataT, type DeviceId } from '../../i18n/myData';
import {
  formatBytes,
  readInventory,
  type Inventory,
  type InventoryEnv,
  type KeyGroup,
} from './deviceInventory';
import { MyDataFrame } from './MyDataFrame';

const ICON: Record<DeviceId, string> = {
  signin: 'key',
  offline: 'cloud-slash',
  cache: 'clock',
  settings: 'gear',
  atlas: 'sparkle',
  consent: 'shield-check',
  reminders: 'bell',
  gymsearch: 'map-pin',
  other: 'note',
  idbCoachChat: 'chat-circle',
  idbSigner: 'key',
  idbAvatars: 'user-circle',
  idbVault: 'lock-simple',
  idbPrefs: 'bell',
  idbFirestore: 'cloud-slash',
  idbOther: 'note',
  appFiles: 'image-square',
};
const NEEDED: readonly DeviceId[] = [
  'signin',
  'idbVault',
  'idbSigner',
  'idbCoachChat',
  'idbFirestore',
  'offline',
  'settings',
  'idbAvatars',
  'reminders',
  'idbPrefs',
  'appFiles',
];
const OPTIONAL: readonly DeviceId[] = ['atlas', 'gymsearch', 'consent', 'cache'];
const OTHER: readonly DeviceId[] = ['other', 'idbOther'];

interface Row {
  id: DeviceId;
  /** keys or databases found */
  count: number;
  bytes?: number;
}

/** The rows that really exist on this device, in page order. Pure. */
function deviceRows(inv: Inventory, ids: readonly DeviceId[]): Row[] {
  const out: Row[] = [];
  for (const id of ids) {
    if (id === 'appFiles') {
      if (inv.caches) out.push({ id, count: inv.caches });
    } else if (id.startsWith('idb')) {
      const c = inv.idb?.[id];
      if (c) out.push({ id, count: c });
    } else {
      const s = inv.storage[id as KeyGroup];
      if (s) out.push({ id, count: s.keys, bytes: s.bytes });
    }
  }
  return out;
}

export interface DevicePageProps {
  onBack: () => void;
  /** Messages in the Atlas chat on this device (from the chat log). */
  chat: number;
  /** tests */
  env?: InventoryEnv;
  clear?: () => Promise<void>;
}

export function DevicePage({
  onBack,
  chat,
  env,
  clear = () => signOut({ forget: true }),
}: DevicePageProps) {
  const { locale } = useT();
  const m = useMyDataT();
  const [inv, setInv] = useState<Inventory | null>(null);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void readInventory(env).then((r) => live && setInv(r));
    return () => {
      live = false;
    };
  }, [env, chat]);

  const sub = (r: Row): string => {
    const parts = [m.device[r.id].sub];
    if (r.id === 'atlas') parts.push(m.devMessages(chat));
    else if (r.count > 1 || r.bytes !== undefined) parts.push(m.devItems(r.count));
    if (r.bytes !== undefined) parts.push(m.devMeasure(formatBytes(r.bytes, locale)));
    return parts.join(' · ');
  };
  const list = (header: string, ids: readonly DeviceId[]) => {
    const rows = inv ? deviceRows(inv, ids) : [];
    if (rows.length === 0) return null;
    return (
      <GroupedList header={header}>
        {rows.map((r) => (
          <ListRow
            key={r.id}
            icon={<IconTile size={30} icon={ICON[r.id]} />}
            label={m.device[r.id].label}
            sub={sub(r)}
          />
        ))}
      </GroupedList>
    );
  };

  async function doClear() {
    setAsking(false);
    setBusy(true);
    setFailed(false);
    try {
      await clear();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MyDataFrame title={m.areas.device.title} sub={m.devSub} onBack={onBack}>
      <Notice tone="neutral" icon="info">
        {m.devNotice}
      </Notice>
      {failed && (
        <Notice tone="danger" icon="warning-circle">
          {m.devClearFailed}
        </Notice>
      )}
      {!inv && <Hint>{m.devLoading}</Hint>}
      {list(m.devHeadNeeded, NEEDED)}
      {list(m.devHeadOptional, OPTIONAL)}
      {list(m.devHeadOther, OTHER)}
      {inv?.usage != null && <Hint>{m.devTotal(formatBytes(inv.usage, locale))}</Hint>}
      {inv && inv.idb === null && <Hint>{m.devNoList}</Hint>}
      <GroupedList header={m.devHeadClear} footer={m.devClearFoot}>
        <ListRow
          action
          tone="danger"
          label={m.devClear}
          disabled={busy}
          onClick={() => setAsking(true)}
        />
      </GroupedList>
      {asking && (
        <ConfirmDialog
          danger
          icon="trash"
          title={m.devClearTitle}
          body={m.devClearBody}
          confirmLabel={m.devClearConfirm}
          cancelLabel={m.cancel}
          onCancel={() => setAsking(false)}
          onConfirm={() => void doClear()}
        />
      )}
    </MyDataFrame>
  );
}
