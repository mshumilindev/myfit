/**
 * Privacy & encryption: create the vault, save the recovery key, unlock a new device,
 * encrypt existing data. Built only from kit primitives. Shown in Profile → Settings
 * (own profile) while the `conditions` flag is on.
 */
import { useState, useSyncExternalStore } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Field } from './ui/Field';
import { GroupedList, ListRow } from './ui/GroupedList';
import { IconTile } from './ui/IconTile';
import { Notice } from './ui/Notice';
import { Sheet } from './ui/Overlays';
import { ProgressBar } from './ui/ProgressBar';
import { useT } from '../i18n';
import { migratePorts, vault } from '../vaultIO';
import { MIGRATION_ORDER, migrateAll } from '../vaultMigrate';
import { workoutStats } from '../store';
import type { Workout } from '../types';

function useVaultStatus() {
  return useSyncExternalStore(vault.subscribe, vault.status);
}

const enrich = (d: Record<string, unknown>) => ({
  ...d,
  stats: workoutStats(d as unknown as Workout),
});

/** Every readable document as one JSON file, so nothing can be lost by the migration. */
async function downloadBackup() {
  const ports = migratePorts(enrich);
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const c of MIGRATION_ORDER)
    out[c] = (await ports.list(c)).map((x) => ({ id: x.id, ...x.data }));
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `spotter-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function RecoveryKeySheet({ code, onDone }: { code: string; onDone: () => void }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* the key stays visible; the user can select it */
    }
  };
  const save = () => {
    const url = URL.createObjectURL(
      new Blob([`Spotter recovery key\n\n${code}\n`], { type: 'text/plain' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spotter-recovery-key.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Sheet onClose={() => undefined} tone="chronic" padded>
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-10">
          <IconTile tone="chronic" size={36} icon="key" />
          <h3 className="title-20">{t.vaultKeyTitle}</h3>
        </div>
        <p className="ut-muted">{t.vaultKeyBody}</p>
        <Field label={t.vaultKeyLabel} value={code} readOnly spellCheck={false} />
        <div className="ul-flex ug-8">
          <Button variant="secondary" onClick={copy}>
            {copied ? t.vaultCopied : t.vaultCopy}
          </Button>
          <Button variant="secondary" onClick={save}>
            {t.vaultDownload}
          </Button>
        </div>
        <Button variant="primary" onClick={onDone}>
          {t.vaultSaved}
        </Button>
      </div>
    </Sheet>
  );
}

function Migrate() {
  const { t } = useT();
  const [pct, setPct] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const run = async () => {
    setState('running');
    setPct(0);
    const total = MIGRATION_ORDER.length;
    const { ok } = await migrateAll(vault, migratePorts(enrich), (c, d, n) =>
      setPct(((MIGRATION_ORDER.indexOf(c) + (n ? d / n : 1)) / total) * 100),
    ).catch(() => ({ ok: false }));
    setState(ok ? 'done' : 'failed');
  };
  return (
    <GroupedList header={t.vaultMigrateTitle}>
      <ListRow
        icon={<IconTile tone="chronic" size={30} icon="database" />}
        label={state === 'done' ? t.vaultMigrated : t.vaultMigrateBody}
      />
      {state === 'running' && pct != null && (
        <Card pad="md" emphasis="quiet">
          <ProgressBar value={pct} tone="chronic" label={t.vaultMigrating} />
        </Card>
      )}
      {state === 'failed' && <Notice tone="danger">{t.vaultFailed}</Notice>}
      {state !== 'done' && state !== 'running' && (
        <>
          <ListRow
            action
            tone="accent"
            label={t.vaultBackup}
            onClick={() => void downloadBackup()}
          />
          <ListRow action tone="chronic" label={t.vaultMigrate} onClick={() => void run()} />
        </>
      )}
    </GroupedList>
  );
}

export function PrivacyVault() {
  const { t } = useT();
  const status = useVaultStatus();
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === 'unknown') return null;

  return (
    <>
      {status === 'unset' && (
        <GroupedList header={t.vaultTitle}>
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="lock-open" />}
            label={t.vaultOffTitle}
            sub={t.vaultOffBody}
          />
          <ListRow
            action
            tone="chronic"
            label={t.vaultTurnOn}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setCode(await vault.create());
              } finally {
                setBusy(false);
              }
            }}
          />
        </GroupedList>
      )}

      {status === 'locked' && (
        <GroupedList header={t.vaultTitle}>
          <ListRow
            icon={<IconTile tone="chronic" size={30} icon="lock" />}
            label={t.vaultLockedTitle}
            sub={t.vaultLockedBody}
          />
          <Card pad="md" emphasis="quiet" className="ul-flex ul-col ug-8">
            <Field
              label={t.vaultKeyLabel}
              value={input}
              error={wrong ? t.vaultWrongKey : undefined}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setInput(e.target.value);
                setWrong(false);
              }}
            />
            <Button
              variant="primary"
              disabled={busy || !input.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  const ok = await vault.unlock(input);
                  setWrong(!ok);
                  if (ok) setInput('');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t.vaultUnlock}
            </Button>
          </Card>
        </GroupedList>
      )}

      {status === 'ready' && (
        <>
          <GroupedList header={t.vaultTitle}>
            <ListRow
              icon={<IconTile tone="chronic" size={30} icon="shield-check" />}
              label={t.vaultOnTitle}
              sub={t.vaultOnBody}
            />
            <ListRow label={t.vaultCoachNote} dim />
            <ListRow action tone="danger" label={t.vaultLock} onClick={() => void vault.lock()} />
          </GroupedList>
          <Migrate />
        </>
      )}

      {code && <RecoveryKeySheet code={code} onDone={() => setCode(null)} />}
    </>
  );
}
