/** Gyms — design S-41…S-48. */
import { useState } from 'react';
import type { Shell } from '../App';
import type { Gym } from '../types';
import { deleteGym, getCurrentPositionOnce, upsertGym, type useStore } from '../store';
import { useT } from '../i18n';
import { Dialog, Icon, LanguageSelector, Sheet, Spinner } from '../ui';

type Store = ReturnType<typeof useStore>;

type AddState =
  | { phase: 'idle' }
  | { phase: 'locating' }
  | { phase: 'denied' }
  | { phase: 'coarse'; lat: number; lng: number; accuracy: number };

export function GymsView({ shell, store }: { shell: Shell; store: Store }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [add, setAdd] = useState<AddState>({ phase: 'idle' });
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Gym | null>(null);
  const [radius, setRadius] = useState(150);
  const [deleting, setDeleting] = useState<Gym | null>(null);

  async function locate() {
    setAdd({ phase: 'locating' });
    try {
      const pos = await getCurrentPositionOnce();
      if (pos.accuracy > 100) {
        setAdd({ phase: 'coarse', ...pos });
        return;
      }
      saveGym(pos.lat, pos.lng, pos.accuracy);
    } catch {
      setAdd({ phase: 'denied' });
    }
  }

  function saveGym(lat: number, lng: number, accuracy: number, radiusM = 150) {
    const g = upsertGym({ name: name.trim(), lat, lng, radiusM });
    setJustAdded(g.id);
    setName('');
    setAdd({ phase: 'idle' });
    shell.toast({ kind: 'ok', icon: 'check-circle', text: t.gymAdded(Math.round(accuracy)) });
  }

  const denied = add.phase === 'denied';

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <h1 className="title-26">{t.gyms}</h1>
        <LanguageSelector />
      </div>
      {store.gyms.length === 0 && add.phase === 'idle' && (
        <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-neutral-500)', margin: 0 }}>
          {t.gymsIntro}
        </p>
      )}

      {denied && (
        <div className="error-card">
          <div style={{ display: 'flex', gap: 10 }}>
            <Icon name="map-pin-slash" className="" />
            <div>
              <div style={{ fontSize: 14, color: 'var(--color-danger-text)' }}>
                {t.locationBlocked}
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--color-danger-text)',
                  opacity: 0.8,
                  marginTop: 5,
                }}
              >
                {t.locationBlockedBody}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
            <button
              className="btn btn-secondary"
              style={{ minHeight: 36, fontSize: 13 }}
              onClick={locate}
            >
              {t.tryAgain}
            </button>
          </div>
        </div>
      )}

      {add.phase === 'coarse' && (
        <>
          <div className="banner danger-ring">
            <Icon name="warning-circle" />
            <span>{t.gpsCoarse(Math.round(add.accuracy))}</span>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <button
              className="btn btn-secondary"
              style={{ minHeight: 38, fontSize: 13 }}
              onClick={() => saveGym(add.lat, add.lng, add.accuracy, 250)}
            >
              {t.saveAnyway}
            </button>
            <button
              className="btn btn-secondary"
              style={{ minHeight: 38, fontSize: 13, gap: 6 }}
              onClick={locate}
            >
              <Icon name="arrow-clockwise" />
              {t.retry}
            </button>
          </div>
        </>
      )}

      <div className="addrow" style={denied ? { opacity: 0.45 } : undefined}>
        <input
          className="input"
          placeholder={t.gymName}
          value={name}
          disabled={denied || add.phase === 'locating'}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn btn-primary"
          disabled={!name.trim() || denied || add.phase === 'locating'}
          onClick={locate}
        >
          {add.phase === 'locating' ? (
            <>
              <Spinner onAccent />
              {t.locating}
            </>
          ) : (
            <>
              <Icon name="crosshair" />
              {t.imHere}
            </>
          )}
        </button>
      </div>

      {add.phase === 'locating' && (
        <div className="locating-card">
          <div className="row">
            <Icon name="crosshair" />
            <span style={{ flex: 1 }}>{t.readingPosition}</span>
          </div>
          <div className="sk" style={{ height: 10, width: '70%' }} />
          <div className="sk" style={{ height: 10, width: '45%' }} />
          <div className="footnote">{t.locatingNote}</div>
        </div>
      )}

      {store.gyms.length === 0 && add.phase === 'idle' && !denied ? (
        <>
          <div className="empty">
            <Icon name="map-pin" />
            <div className="t">{t.noGymsYet}</div>
            <div className="s">{t.noGymsBody}</div>
          </div>
          <div className="footnote" style={{ marginTop: 'auto' }}>
            {t.gymsFootnote}
          </div>
        </>
      ) : (
        store.gyms.map((g) => (
          <div key={g.id} className={`gym-card${justAdded === g.id ? ' just-added' : ''}`}>
            <div className="head">
              <span className="n">{g.name}</span>
              <button
                className="dots"
                aria-label="Menu"
                onClick={() => {
                  setEditing(g);
                  setRadius(g.radiusM);
                }}
              >
                <Icon name="dots-three-vertical" />
              </button>
            </div>
            <div className="meta">
              <span>
                {g.lat.toFixed(5)}, {g.lng.toFixed(5)}
              </span>
              <span>{t.radiusM(g.radiusM)}</span>
            </div>
          </div>
        ))
      )}

      {denied && (
        <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--color-neutral-500)' }}>
          {t.locationBlockedFootnote}
        </div>
      )}

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <div className="sheet-head">
            <span className="t">{editing.name}</span>
          </div>
          <div className="slider-block">
            <div className="head">
              <span>{t.radius}</span>
              <span className="v">{radius} m</span>
            </div>
            <input
              type="range"
              min={30}
              max={2000}
              step={10}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
            <div className="scale">
              <span>30 m</span>
              <span>2 000 m</span>
            </div>
          </div>
          <div className="info-row">
            <Icon name="info" />
            <span>{t.radiusHint}</span>
          </div>
          <div className="sheet-actions">
            <button
              className="danger-outline"
              style={{ minHeight: 44 }}
              onClick={() => {
                setDeleting(editing);
                setEditing(null);
              }}
            >
              <Icon name="trash" />
              {t.delete}
            </button>
            <button className="btn btn-secondary grow" onClick={() => setEditing(null)}>
              {t.cancel}
            </button>
            <button
              className="btn btn-primary grow"
              onClick={() => {
                upsertGym({ ...editing, radiusM: radius });
                setEditing(null);
              }}
            >
              {t.save}
            </button>
          </div>
        </Sheet>
      )}

      {deleting && (
        <Dialog
          danger
          title={t.deleteGymTitle(deleting.name)}
          onClose={() => setDeleting(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>
                {t.keep}
              </button>
              <button
                className="danger-outline"
                onClick={() => {
                  deleteGym(deleting.id);
                  setDeleting(null);
                }}
              >
                {t.delete}
              </button>
            </>
          }
        >
          {t.deleteGymBody(store.reminders.filter((r) => r.gymId === deleting.id).length)}
        </Dialog>
      )}
    </div>
  );
}
