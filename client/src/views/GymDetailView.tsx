/** Gym detail — design G-06. Works for a saved gym OR an unsaved search result
 *  (candidate): shows photo/hours/map for both, "Add this gym" when unsaved,
 *  edit/delete/stats when saved. Includes an OSM map + route from my location. */
import { useEffect, useMemo, useState } from 'react';
import type { Shell } from '../App';
import {
  useStore,
  startWorkout,
  deleteGym,
  upsertGym,
  getCurrentPositionOnce,
  workoutVolumeKg,
} from '../store';
import { DEFAULT_GYM_RADIUS_M } from '../types';
import {
  resolveAddress,
  resolveGymMeta,
  parseOpeningHours,
  haversineM,
  fmtDistance,
  type GymMeta,
  type Coords,
} from '../data/gymProviders';
import { fmtTonnes, fmtDurationHM, useT } from '../i18n';
import { Icon, ConfirmDialog } from '../ui';
import { GymThumb } from '../components/GymThumb';
import { RouteMap } from '../components/RouteMap';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

export function GymDetailView({
  gymId,
  candName,
  candLat,
  candLng,
  candAddress,
  shell,
  onClose,
}: {
  gymId?: string;
  candName?: string;
  candLat?: number;
  candLng?: number;
  candAddress?: string;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();

  // Resolve the underlying gym: by id, or by matching a candidate's coords to a
  // saved gym (so opening a search result that's already saved shows it saved).
  const gym = useMemo(() => {
    const byId = gymId ? store.gyms.find((g) => g.id === gymId) : undefined;
    if (byId) return byId;
    if (candLat !== undefined && candLng !== undefined) {
      return store.gyms.find(
        (g) => Math.abs(g.lat - candLat) < 1e-4 && Math.abs(g.lng - candLng) < 1e-4,
      );
    }
    return undefined;
  }, [store.gyms, gymId, candLat, candLng]);

  const name = gym?.name ?? candName;
  const lat = gym?.lat ?? candLat;
  const lng = gym?.lng ?? candLng;
  const isSaved = !!gym;

  const [coords, setCoords] = useState<Coords | null>(null);
  const [addr, setAddr] = useState<string | null>(candAddress ?? null);
  const [meta, setMeta] = useState<GymMeta | null>(null);
  const [showWeek, setShowWeek] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    let alive = true;
    getCurrentPositionOnce()
      .then((p) => alive && setCoords({ lat: p.lat, lng: p.lng }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let alive = true;
    const sig = new AbortController().signal;
    if (!candAddress)
      resolveAddress(lat, lng, sig)
        .then((a) => a && alive && setAddr(a))
        .catch(() => {});
    resolveGymMeta(lat, lng, sig, name)
      .then((m) => alive && setMeta(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lat, lng, name, candAddress]);

  const parsed = useMemo(() => meta?.hours ?? parseOpeningHours(meta?.openingHours), [meta]);
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(
      { en: 'en-US', uk: 'uk-UA', pl: 'pl-PL', lt: 'lt-LT', et: 'et-EE' }[locale],
      { weekday: 'short' },
    );
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const nowD = new Date();
  const todayIdx = (nowD.getDay() + 6) % 7;
  const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
  const is247 =
    !!parsed && parsed.week.every((d) => d.length === 1 && d[0][0] === 0 && d[0][1] >= 1440);
  const computedOpen = useMemo(() => {
    if (!parsed) return null;
    const inRange = (r: [number, number]) =>
      r[1] > r[0] ? nowMin >= r[0] && nowMin < r[1] : nowMin >= r[0] || nowMin < r[1];
    return parsed.week[todayIdx].some(inRange);
  }, [parsed, todayIdx, nowMin]);
  // Prefer live computation from the hours (local clock): the provider's
  // openNow is cached for days and shows the state at fetch time, not now.
  const openNow = computedOpen ?? meta?.openNow ?? null;

  const fmtDay = (ranges: Array<[number, number]>) =>
    ranges.length === 0
      ? t.gymDayClosed
      : ranges.map((r) => `${hhmm(r[0])}–${hhmm(r[1])}`).join(', ');

  if (lat === undefined || lng === undefined || !name) {
    return (
      <div className="screen">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
      </div>
    );
  }

  const ensureSaved = () => gym ?? upsertGym({ name, lat, lng, radiusM: DEFAULT_GYM_RADIUS_M });

  const sessions = gym
    ? store.workouts.filter((w) => w.gymId === gym.id && w.finishedAt !== null)
    : [];
  const totalVol = sessions.reduce((s, w) => s + workoutVolumeKg(w), 0);
  const avgMs = sessions.length
    ? sessions.reduce((s, w) => s + ((w.finishedAt ?? 0) - w.startedAt), 0) / sessions.length
    : 0;
  const dist = coords ? haversineM(coords, { lat, lng }) : null;
  const inside = dist !== null && dist <= (gym?.radiusM ?? DEFAULT_GYM_RADIUS_M);

  const directionsHref = coords
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${coords.lat}%2C${coords.lng}%3B${lat}%2C${lng}`
    : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  return (
    <div className="gym-detail">
      <div className="gym-detail-hero">
        <GymThumb name={name} lat={lat} lng={lng} size={320} />
        <div className="hero-scrim" />
        <button className="hero-back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div className="hero-top-right"></div>
        <div className="hero-text">
          <h2>{name}</h2>
          <div className="loc">
            <Icon name="map-pin" />
            <span>
              {addr ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
              {dist !== null ? ` · ${fmtDistance(dist)}` : ''}
            </span>
          </div>
          {inside && (
            <span className="tag tag-accent" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              {t.inside}
            </span>
          )}
        </div>
      </div>

      <div className="gym-detail-body">
        {!isSaved && (
          <button className="btn btn-primary btn-big" onClick={() => ensureSaved()}>
            <Icon name="plus" />
            {t.gymAdd}
          </button>
        )}
        <button
          className={isSaved ? 'btn btn-primary btn-big' : 'btn btn-secondary btn-big'}
          onClick={() => {
            const g = ensureSaved();
            const w = startWorkout(g.id);
            shell.openOverlay({ screen: 'session', workoutId: w.id });
          }}
        >
          <Icon name="play" />
          {t.startSessionHere}
        </button>

        {/* Hours */}
        <div className="detail-card">
          <div className="detail-card-head">
            <span className="label">
              <Icon name="clock" /> {t.gymHours}
            </span>
            {openNow !== null && (
              <span className={`hours-badge ${openNow ? 'open' : 'closed'}`}>
                {openNow ? t.gymOpenNow : t.gymClosedNow}
              </span>
            )}
          </div>
          {!parsed ? (
            <div className="detail-muted">{t.gymHoursUnknown}</div>
          ) : is247 ? (
            <div className="hours-today">{t.gymOpen247}</div>
          ) : (
            <>
              <div className="hours-today">
                <span>{weekdays[todayIdx]}</span>
                <span>{fmtDay(parsed.week[todayIdx])}</span>
              </div>
              <button className="hours-toggle" onClick={() => setShowWeek((x) => !x)}>
                {t.gymAllWeek}
                <Icon name={showWeek ? 'caret-left' : 'arrow-right'} />
              </button>
              {showWeek && (
                <div className="hours-week">
                  {parsed.week.map((ranges, i) => (
                    <div key={i} className={`row${i === todayIdx ? ' today' : ''}`}>
                      <span>{weekdays[i]}</span>
                      <span>{fmtDay(ranges)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Map + route */}
        <div className="detail-card map-card">
          <div className="detail-card-head">
            <span className="label">
              <Icon name="map-pin" /> {t.gymMap}
            </span>
          </div>
          <RouteMap from={coords} to={{ lat, lng }} />
          <a
            className="btn btn-secondary map-directions"
            href={directionsHref}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="crosshair" />
            {t.gymDirections}
          </a>
        </div>

        {/* Contact */}
        {(meta?.website || meta?.phone) && (
          <div className="detail-links">
            {meta.website && (
              <a className="btn btn-secondary" href={meta.website} target="_blank" rel="noreferrer">
                <Icon name="globe" />
                {t.gymWebsite}
              </a>
            )}
            {meta.phone && (
              <a className="btn btn-secondary" href={`tel:${meta.phone}`}>
                <Icon name="phone" />
                {t.gymCall}
              </a>
            )}
          </div>
        )}

        {/* Stats (saved only) */}
        {isSaved &&
          (sessions.length > 0 ? (
            <div className="stat-grid">
              <div className="cell">
                <div className="v">{sessions.length}</div>
                <div className="l">{t.gymStatSessions}</div>
              </div>
              <div className="cell">
                <div className="v">{fmtTonnes(totalVol)}</div>
                <div className="l">{t.gymStatMoved}</div>
              </div>
              <div className="cell">
                <div className="v">{fmtDurationHM(avgMs)}</div>
                <div className="l">{t.gymStatAvg}</div>
              </div>
            </div>
          ) : (
            <div className="detail-muted">{t.gymNoStats}</div>
          ))}

        {isSaved && (
          <>
            <div className="detail-meta-row">
              <span>{t.radiusM(gym!.radiusM)}</span>
            </div>
            <button className="danger-outline detail-delete" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" />
              {t.delete}
            </button>
          </>
        )}
      </div>

      {confirmDel && gym && (
        <ConfirmDialog
          title={t.deleteGymTitle(gym.name)}
          body={t.deleteGymBody(sessions.length)}
          confirmLabel={t.delete}
          cancelLabel={t.keep}
          danger
          onConfirm={() => {
            deleteGym(gym.id);
            setConfirmDel(false);
            onClose();
          }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
