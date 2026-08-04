/** Gyms — design S-41…S-48. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Shell } from '../App';
import {
  getCurrentPositionOnce,
  startWorkout,
  upsertGym,
  workoutVolumeKg,
  type useStore,
} from '../store';
import { DEFAULT_GYM_RADIUS_M } from '../types';
import {
  searchGyms,
  readCache,
  haversineM,
  resolvePhoto,
  staticMapThumb,
  resolveAddress,
  cacheAddress,
  type Coords,
  type PlaceResult,
  type ProviderKeys,
  type ProviderId,
  type ProviderState,
} from '../data/gymProviders';
import { HouseGraphic } from '../components/HouseGraphic';
import { GymThumb } from '../components/GymThumb';
import { RouteMap } from '../components/RouteMap';
import { fmtDayMonth, fmtDurationHM, fmtTonnes, useT } from '../i18n';
import { Icon } from '../ui';

// Optional place-provider keys, read from Vite env at build time. Absent keys
// leave that provider "skipped" (chip greyed) — the app works without them.
// NOTE: these ship in the client bundle; restrict the Google key by HTTP
// referrer in Google Cloud Console. For a fully private key, proxy through the
// server (BFF) instead of calling the provider from the browser.
const GYM_KEYS: ProviderKeys = {
  googlePlaces: import.meta.env.VITE_GOOGLE_PLACES_KEY,
  foursquare: import.meta.env.VITE_FOURSQUARE_KEY,
};

type Store = ReturnType<typeof useStore>;

type AddState =
  | { phase: 'idle' }
  | { phase: 'locating' }
  | { phase: 'denied' }
  | { phase: 'coarse'; lat: number; lng: number; accuracy: number };

export function GymsView({ shell, store }: { shell: Shell; store: Store }) {
  const { t, locale } = useT();
  const [pendingName, setPendingName] = useState('');
  const [add, setAdd] = useState<AddState>({ phase: 'idle' });
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const showDesktopDetail = useDesktopDetail();

  async function locateFor(gymName: string) {
    const n = gymName.trim();
    if (!n) return;
    setPendingName(n);
    setAdd({ phase: 'locating' });
    try {
      const pos = await getCurrentPositionOnce();
      if (pos.accuracy > 100) {
        setAdd({ phase: 'coarse', ...pos });
        return;
      }
      saveGym(n, pos.lat, pos.lng, pos.accuracy);
    } catch {
      setAdd({ phase: 'denied' });
    }
  }

  function saveGym(
    gymName: string,
    lat: number,
    lng: number,
    accuracy: number,
    radiusM = DEFAULT_GYM_RADIUS_M,
  ) {
    const g = upsertGym({ name: gymName.trim(), lat, lng, radiusM });
    setJustAdded(g.id);
    setAdd({ phase: 'idle' });
    setPendingName('');
    shell.toast({ kind: 'ok', icon: 'check-circle', text: t.gymAdded(Math.round(accuracy)) });
  }

  const denied = add.phase === 'denied';
  const selectedGym = useMemo(
    () => store.gyms.find((g) => g.id === selectedGymId) ?? store.gyms[0] ?? null,
    [selectedGymId, store.gyms],
  );
  const selectedSessions = useMemo(
    () =>
      selectedGym
        ? store.workouts
            .filter((w) => w.gymId === selectedGym.id && w.finishedAt !== null)
            .sort((a, b) => b.startedAt - a.startedAt)
        : [],
    [selectedGym, store.workouts],
  );
  const totalVol = selectedSessions.reduce((sum, workout) => sum + workoutVolumeKg(workout), 0);
  const avgMs = selectedSessions.length
    ? selectedSessions.reduce(
        (sum, workout) => sum + ((workout.finishedAt ?? 0) - workout.startedAt),
        0,
      ) / selectedSessions.length
    : 0;

  // Saved-gym thumbnails (logo → map tile → graphic) and street addresses,
  // resolved lazily per gym and keyed by id. Both are cache-backed and cheap,
  // so we re-attempt whenever an entry is still missing (survives StrictMode's
  // double-mount and the sync that swaps store.gyms — a fixed AbortController
  // would cancel these and never retry).
  const [savedAddrs, setSavedAddrs] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const sig = new AbortController().signal; // never aborted — enrichment is idempotent
    for (const g of store.gyms) {
      if (!savedAddrs[g.id]) {
        resolveAddress(g.lat, g.lng, sig)
          .then((addr) => {
            if (addr && alive) setSavedAddrs((m) => ({ ...m, [g.id]: addr }));
          })
          .catch(() => {});
      }
    }
    return () => {
      alive = false;
    };
  }, [store.gyms, savedAddrs]);

  const openGym = (g: NonNullable<typeof selectedGym>) =>
    shell.openOverlay({
      screen: 'gym',
      gymId: g.id,
      name: g.name,
      lat: g.lat,
      lng: g.lng,
      address: savedAddrs[g.id],
    });

  const startAtSelectedGym = () => {
    if (!selectedGym) return;
    const workout = startWorkout(selectedGym.id);
    shell.openOverlay({ screen: 'session', workoutId: workout.id });
  };

  return (
    <div className="screen gyms-page">
      <div className="gyms-layout">
        <section className="gyms-list-pane">
          <div className="gyms-title-row">
            <h2 className="title-26">{t.gyms}</h2>
          </div>
          {store.gyms.length === 0 && add.phase === 'idle' && (
            <p className="gyms-intro">{t.gymsIntro}</p>
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
                  onClick={() => locateFor(pendingName)}
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
                  onClick={() => saveGym(pendingName, add.lat, add.lng, add.accuracy, 250)}
                >
                  {t.saveAnyway}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ minHeight: 38, fontSize: 13, gap: 6 }}
                  onClick={() => locateFor(pendingName)}
                >
                  <Icon name="arrow-clockwise" />
                  {t.retry}
                </button>
              </div>
            </>
          )}

          {store.gyms.length > 0 && <div className="section-label">{t.myGyms}</div>}
          {store.gyms.length > 0 &&
            store.gyms.map((g) => {
              const selected = selectedGym?.id === g.id;
              return (
                <div
                  key={g.id}
                  className={`gym-card tappable${justAdded === g.id ? ' just-added' : ''}${
                    selected ? ' selected' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onMouseEnter={() => setSelectedGymId(g.id)}
                  onFocus={() => setSelectedGymId(g.id)}
                  onClick={() => {
                    setSelectedGymId(g.id);
                    openGym(g);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedGymId(g.id);
                      openGym(g);
                    }
                  }}
                >
                  <span className="thumb">
                    <GymThumb name={g.name} lat={g.lat} lng={g.lng} />
                  </span>
                  <div className="gym-card-body">
                    <div className="head">
                      <span className="n">{g.name}</span>
                    </div>
                    <div className="meta">
                      <span>{savedAddrs[g.id] ?? `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`}</span>
                      <span>{t.radiusM(g.radiusM)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

          {!denied && (
            <GymSearch
              savedGyms={store.gyms}
              busy={add.phase === 'locating'}
              onPick={(r) => {
                if (r.address) cacheAddress(r.lat, r.lng, r.address);
                shell.openOverlay({
                  screen: 'gym',
                  name: r.name,
                  lat: r.lat,
                  lng: r.lng,
                  address: r.address,
                });
              }}
              onManualHere={(n) => locateFor(n)}
            />
          )}

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

          {store.gyms.length === 0 && add.phase === 'idle' && !denied && (
            <>
              <div className="empty">
                <Icon name="map-pin" />
                <h4 className="t">{t.noGymsYet}</h4>
                <p className="s">{t.noGymsBody}</p>
              </div>
              <div className="footnote" style={{ marginTop: 'auto' }}>
                {t.gymsFootnote}
              </div>
            </>
          )}

          {denied && (
            <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--color-neutral-500)' }}>
              {t.locationBlockedFootnote}
            </div>
          )}
        </section>

        {showDesktopDetail && selectedGym && (
          <aside className="gyms-detail-pane">
            <div className="gyms-detail-hero">
              <GymThumb
                name={selectedGym.name}
                lat={selectedGym.lat}
                lng={selectedGym.lng}
                size={480}
              />
              <div className="gyms-hero-scrim" />
              <div className="gyms-hero-text">
                <h1>{selectedGym.name}</h1>
                <p>
                  {savedAddrs[selectedGym.id] ??
                    `${selectedGym.lat.toFixed(5)}, ${selectedGym.lng.toFixed(5)}`}
                </p>
              </div>
            </div>

            <div className="gyms-detail-body">
              <div className="gyms-actions">
                <button className="btn btn-primary" onClick={startAtSelectedGym}>
                  <Icon name="play" />
                  {t.startSessionHere}
                </button>
                <button className="btn btn-secondary" onClick={() => openGym(selectedGym)}>
                  <Icon name="pencil-simple" />
                  {t.edit}
                </button>
              </div>

              {selectedSessions.length > 0 ? (
                <div className="gyms-stat-grid">
                  <div className="cell">
                    <div className="v">{selectedSessions.length}</div>
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
              )}

              <section className="gyms-panel">
                <div className="gyms-panel-head">
                  <span>{t.lastSessions}</span>
                  <span>{t.radiusM(selectedGym.radiusM)}</span>
                </div>
                {selectedSessions.length > 0 ? (
                  <div className="gyms-session-table">
                    {selectedSessions.slice(0, 5).map((workout) => (
                      <button
                        key={workout.id}
                        className="gyms-session-row"
                        onClick={() =>
                          shell.openOverlay({ screen: 'past-workout', workoutId: workout.id })
                        }
                      >
                        <span>
                          <strong>{fmtDayMonth(workout.startedAt, locale)}</strong>
                          <small>
                            {workout.exercises.map((exercise) => exercise.name).join(' · ') ||
                              t.noExercisesYet}
                          </small>
                        </span>
                        <span>
                          {fmtTonnes(workoutVolumeKg(workout))}
                          <small>
                            {workout.finishedAt
                              ? fmtDurationHM(workout.finishedAt - workout.startedAt)
                              : '—'}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="detail-muted">{t.gymNoStats}</p>
                )}
              </section>

              <section className="gyms-map-panel">
                <div className="gyms-panel-head">
                  <span>{t.gymMap}</span>
                  <span>{t.gymDirections}</span>
                </div>
                <RouteMap from={null} to={{ lat: selectedGym.lat, lng: selectedGym.lng }} />
              </section>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function getDesktopDetailMatch(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(min-width: 960px)').matches
  );
}

function useDesktopDetail(): boolean {
  const [matches, setMatches] = useState(getDesktopDetailMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(min-width: 960px)');
    const onChange = () => setMatches(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return matches;
}

const PROVIDER_ORDER: ProviderId[] = ['local', 'osm', 'google', 'foursquare'];

/**
 * Suggestive gym search (AC-SEARCH). Debounced 350 ms; each keystroke cancels
 * the previous query. Providers stream in; chips show per-provider state;
 * skeleton rows appear between 300 ms and the first result.
 */
function GymSearch({
  savedGyms,
  onPick,
  onManualHere,
  busy,
}: {
  savedGyms: Store['gyms'];
  onPick: (r: PlaceResult) => void;
  onManualHere: (name: string) => void;
  busy: boolean;
}) {
  const { t, locale } = useT();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [providers, setProviders] = useState<Record<ProviderId, ProviderState>>(
    {} as Record<ProviderId, ProviderState>,
  );
  const [showSkeleton, setShowSkeleton] = useState(false);
  const coordsRef = useRef<Coords | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [nearby, setNearby] = useState<PlaceResult[]>([]);

  // One geolocation read to bias results (AC-SEARCH-01); silent on denial.
  useEffect(() => {
    let alive = true;
    getCurrentPositionOnce()
      .then((p) => {
        if (alive) {
          coordsRef.current = { lat: p.lat, lng: p.lng };
          setCoords({ lat: p.lat, lng: p.lng });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Nearby suggestions: once we have a location, fetch a few closest gyms with a
  // generic locale term so the list has something useful before any typing.
  useEffect(() => {
    if (!coords) return;
    const ctrl = new AbortController();
    void searchGyms(t.nearbyQuery, coords, GYM_KEYS, savedGyms, ctrl.signal, {
      onResults: (merged) => {
        if (!ctrl.signal.aborted) setNearby([...merged]);
      },
      onProvider: () => {},
    });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const needle = q.trim();

  useEffect(() => {
    abortRef.current?.abort();
    if (needle.length < 2) return; // render is gated on needle length; no reset needed
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const cached = readCache(needle, coordsRef.current);
    const skeletonTimer = setTimeout(() => {
      if (!ctrl.signal.aborted) setShowSkeleton((cached?.length ?? 0) === 0);
    }, 300);
    const debounce = setTimeout(() => {
      if (cached) setResults(cached);
      setProviders({} as Record<ProviderId, ProviderState>);
      void searchGyms(needle, coordsRef.current, GYM_KEYS, savedGyms, ctrl.signal, {
        onResults: (merged) => {
          if (!ctrl.signal.aborted) {
            setResults([...merged]);
            setShowSkeleton(false);
          }
        },
        onProvider: (id, state) => {
          if (!ctrl.signal.aborted) setProviders((p) => ({ ...p, [id]: state }));
        },
      });
    }, 350);
    return () => {
      clearTimeout(debounce);
      clearTimeout(skeletonTimer);
      ctrl.abort();
    };
  }, [needle, savedGyms]);

  const li = useMemo(() => locale, [locale]);

  // Sort nearest-first when we have a location (AC: closer gyms rank higher).
  const sorted = useMemo(() => {
    if (!coords) return results;
    return [...results].sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
  }, [results, coords]);

  // Closest 5 nearby gyms not already saved (within ~80 m counts as saved).
  const nearbySorted = useMemo(() => {
    if (!coords) return [] as PlaceResult[];
    const isSaved = (r: PlaceResult) =>
      savedGyms.some((g) => haversineM({ lat: g.lat, lng: g.lng }, r) < 80);
    return [...nearby]
      .filter((r) => !isSaved(r))
      .sort((a, b) => haversineM(coords, a) - haversineM(coords, b))
      .slice(0, 5);
  }, [nearby, coords, savedGyms]);

  // Lazily resolve a real photo/logo per result (keyless: OSM/Commons/Wikidata).
  // Rows render immediately with a map-tile thumbnail; a photo replaces it if
  // one is found. `requested` guards against re-fetching the same venue.
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const requested = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ctrl = new AbortController();
    for (const r of [...results, ...nearby]) {
      if (r.photoUrl || requested.current.has(r.key)) continue;
      requested.current.add(r.key);
      resolvePhoto(r, ctrl.signal)
        .then((url) => {
          if (url && !ctrl.signal.aborted) setPhotos((m) => ({ ...m, [r.key]: url }));
        })
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [results, nearby]);

  return (
    <div className="gym-search">
      <div className="searchbar">
        <Icon name="magnifying-glass" />
        <input
          value={q}
          placeholder={t.searchGymPlaceholder}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {needle.length < 2 && nearbySorted.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 4 }}>
            {t.nearbyGyms}
          </div>
          {nearbySorted.map((r) => {
            const dist = coords ? haversineM(coords, r) : null;
            return (
              <button key={r.key} className="gym-result" onClick={() => onPick(r)} lang={li}>
                <span className="thumb">
                  <ResultThumb photo={r.photoUrl ?? photos[r.key]} lat={r.lat} lng={r.lng} />
                </span>
                <span className="body">
                  <span className="name">{r.name}</span>
                  {(r.address || dist !== null) && (
                    <span className="addr">
                      {dist !== null ? `${fmtDistance(dist)}${r.address ? ' · ' : ''}` : ''}
                      {r.address}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </>
      )}

      {needle.length >= 2 && (
        <div className="provider-chips">
          {PROVIDER_ORDER.map((id) => {
            const st = providers[id];
            const status = st?.status ?? 'pending';
            return (
              <span key={id} className={`provider-chip ${status}`}>
                {status === 'pending' ? (
                  <span className="sk-dot" />
                ) : status === 'answered' ? (
                  <Icon name="check-circle" weight="fill" />
                ) : null}
                {t.providerNames[id]}
                {st?.status === 'answered' ? ` ${st.count}` : st?.status === 'failed' ? ' —' : ''}
              </span>
            );
          })}
        </div>
      )}

      {showSkeleton &&
        [0, 1, 2].map((i) => (
          <div key={i} className="gym-result skeleton">
            <div className="sk thumb" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="sk" style={{ width: '55%', height: 13 }} />
              <div className="sk" style={{ width: '75%', height: 9 }} />
            </div>
          </div>
        ))}

      {needle.length >= 2 &&
        sorted.map((r) => {
          const dist = coords ? haversineM(coords, r) : null;
          return (
            <button key={r.key} className="gym-result" onClick={() => onPick(r)} lang={li}>
              <span className="thumb">
                <ResultThumb photo={r.photoUrl ?? photos[r.key]} lat={r.lat} lng={r.lng} />
              </span>
              <span className="body">
                <span className="name">{highlightSubsequence(r.name, needle)}</span>
                {(r.address || dist !== null) && (
                  <span className="addr">
                    {dist !== null ? `${fmtDistance(dist)}${r.address ? ' · ' : ''}` : ''}
                    {r.address}
                  </span>
                )}
              </span>
            </button>
          );
        })}

      {needle.length >= 2 &&
        !showSkeleton &&
        results.length === 0 &&
        PROVIDER_ORDER.every((id) => {
          const st = providers[id];
          return st && st.status !== 'pending';
        }) && <div className="footnote">{t.searchGymEmpty}</div>}

      {needle.length >= 2 && (
        <button className="gym-result manual" disabled={busy} onClick={() => onManualHere(needle)}>
          <span className="thumb">
            {busy ? <span className="sk-dot" /> : <Icon name="crosshair" />}
          </span>
          <span className="body">
            <span className="name" style={{ color: 'var(--color-accent-300)' }}>
              «{needle}»
            </span>
            <span className="addr">{busy ? t.locating : t.imHere}</span>
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * Result thumbnail with a graceful fallback chain: real photo/logo (when
 * resolved) → OSM map-tile of the venue → local house graphic. Each level
 * degrades on load error, so a row is never blank.
 */
function ResultThumb({ photo, lat, lng }: { photo?: string; lat: number; lng: number }) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const map = staticMapThumb(lat, lng);
  const src = photo && !failed.has(photo) ? photo : !failed.has(map) ? map : null;
  if (!src) return <HouseGraphic size={64} />;
  return (
    <img src={src} alt="" loading="lazy" onError={() => setFailed((f) => new Set(f).add(src))} />
  );
}

/** ~distance for a result row: "240 m" / "1.2 km". */
function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/**
 * Highlight, in brass, only the letters of `name` that the query matches as a
 * subsequence (so "portlife" lights p-o-r-t-l-i-f-e inside "Sportlife"), which
 * is what the suggestive-search spec asks for.
 */
function highlightSubsequence(name: string, query: string): ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return name;
  const out: ReactNode[] = [];
  let qi = 0;
  let buf = '';
  let hi = '';
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = '';
    }
  };
  const flushHi = () => {
    if (hi) {
      out.push(
        <span key={out.length} className="hl">
          {hi}
        </span>,
      );
      hi = '';
    }
  };
  for (const ch of name) {
    if (qi < q.length && ch.toLowerCase() === q[qi]) {
      flush();
      hi += ch;
      qi++;
    } else {
      flushHi();
      buf += ch;
    }
  }
  flush();
  flushHi();
  return out;
}
