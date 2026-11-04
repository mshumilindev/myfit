import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import {
  listSessions,
  placeText,
  relativeTime,
  revokeOtherSessions,
  revokeSession,
  sessionDeviceId,
  type SessionRow,
} from '../accounts/sessions';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { ListPanel, ListRow } from './ui/GroupedList';
import { Sheet } from './ui/Overlays';
import { Banner } from './ui/Banner';
import { DeviceImage } from './ui/DeviceImage';

/** A sign-in on another device this recent is called out at the top. */
const NEW_SIGN_IN_MS = 24 * 3_600_000;

/** Records made before SPO-436 have no kind yet: guess it from the label until the next check fills it in. */
const kindOfRow = (r: SessionRow) => r.kind ?? (/iOS|Android/.test(r.label) ? 'phone' : 'computer');

/** Profile → Settings → Sessions (SPO-212): the devices the person is signed in on; sign one out, or all except this one. */
export function SessionsSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState(Date.now);
  const me = sessionDeviceId();

  useEffect(() => {
    let alive = true;
    listSessions()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  async function revoke(id: string) {
    setBusy(true);
    try {
      await revokeSession(id);
      setRows((r) => (r ?? []).filter((x) => x.deviceId !== id));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  async function revokeOthers() {
    setBusy(true);
    try {
      await revokeOtherSessions();
      setRows((r) => (r ?? []).filter((x) => x.deviceId === me));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const others = (rows ?? []).filter((r) => r.deviceId !== me);
  const fresh = others.find((r) => openedAt - r.createdAt < NEW_SIGN_IN_MS);
  return (
    <Sheet onClose={onClose} label={t.sessionsTitle} padded>
      <h2 className="uf-1">{t.sessionsTitle}</h2>
      <p className="detail-muted">{t.sessionsHint}</p>
      {failed && (
        <p role="alert" className="detail-muted">
          {t.sessionsError}
        </p>
      )}
      {fresh && (
        <Banner
          tone="danger"
          icon="warning"
          sheen={false}
          kicker={t.sessionsNewKicker}
          title={fresh.label}
          body={[placeText(fresh), t.sessionsNewBody].filter(Boolean).join(' · ')}
        />
      )}
      {rows !== null && (
        <ListPanel>
          {rows.map((r) => {
            const here = r.deviceId === me;
            const place = placeText(r);
            return (
              <ListRow
                key={r.deviceId}
                icon={<DeviceImage kind={kindOfRow(r)} tone={here ? 'ok' : 'neutral'} />}
                label={r.label}
                sub={[place, relativeTime(r.lastSeenAt, locale)].filter(Boolean).join(' · ')}
                trailing={
                  here ? (
                    <Chip tone="ok" size="xs">
                      {t.sessionsThis}
                    </Chip>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void revoke(r.deviceId)}
                    >
                      {t.sessionsSignOutDevice}
                    </Button>
                  )
                }
              />
            );
          })}
          {rows.length <= 1 && <ListRow label={t.sessionsEmpty} dim />}
        </ListPanel>
      )}
      {others.length > 0 && (
        <Button variant="danger" disabled={busy} onClick={() => void revokeOthers()}>
          {t.sessionsSignOutOthers}
        </Button>
      )}
      <p className="detail-muted">{t.sessionsRevokedNote}</p>
    </Sheet>
  );
}
