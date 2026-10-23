import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchField } from '../components/ui/SearchField';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { getCurrentPositionOnce } from '../store';
import {
  searchGyms,
  searchNearbyGyms,
  haversineM,
  fmtDistance,
  type Coords,
  type PlaceResult,
} from '../data/gymProviders';
import { useT } from '../i18n';
import { Icon } from '../ui';
import { GymThumb } from '../components/GymThumb';
import { GeoOffState } from '../legal/GeoOff';
import { useAskGeoConsent, useGeoSearchOn } from '../legal/useGeoSearch';

// --- Step 3: gym (O-05) — nearby first, search, never blocks on permission --

/** Placeholder gym card — same box as .onb-gym-card (110px photo + two lines). */
function GymCardSkeleton() {
  return (
    <div className="onb-gym-card skeleton" aria-hidden>
      <span className="uisk photo" />
      <span className="body">
        <span className="uisk n" />
        <span className="uisk s" />
      </span>
    </div>
  );
}

export function GymStep({
  rail,
  onPick,
}: {
  rail: React.ReactNode;
  onPick: (r: PlaceResult | null) => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [nearby, setNearby] = useState<PlaceResult[]>([]);
  // The query each list currently reflects — a marker, not a flag, so the
  // loading state is derived (no setState in an effect body). `nearby` is loaded
  // once `nearbyDone` flips; `results` belong to `searchedNeedle`.
  const [nearbyDone, setNearbyDone] = useState(false);
  const [searchedNeedle, setSearchedNeedle] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  // Search, nearby gyms and the location read are outside-service calls: only with the consent (SPO-293). The first
  // visit asks; "Not now" leaves the step skippable.
  const on = useGeoSearchOn();
  useAskGeoConsent();

  useEffect(() => {
    if (!on) return;
    let alive = true;
    getCurrentPositionOnce()
      .then((p) => alive && setCoords({ lat: p.lat, lng: p.lng }))
      .catch(() => alive && setDenied(true));
    return () => {
      alive = false;
    };
  }, [on]);

  const needle = q.trim();
  useEffect(() => {
    abortRef.current?.abort();
    if (!on || needle.length < 2) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const deb = setTimeout(() => {
      void searchGyms(needle, coords, [], ctrl.signal, {
        onResults: (m) => {
          if (!ctrl.signal.aborted) {
            setResults([...m]);
            setSearchedNeedle(needle);
          }
        },
        onProvider: () => {},
      }).finally(() => {
        if (!ctrl.signal.aborted) setSearchedNeedle(needle);
      });
    }, 350);
    return () => {
      clearTimeout(deb);
      ctrl.abort();
    };
  }, [needle, coords, on]);

  useEffect(() => {
    if (!on || !coords) return;
    const ctrl = new AbortController();
    void searchNearbyGyms(coords, 2000, [], ctrl.signal)
      .then((m) => {
        if (!ctrl.signal.aborted) setNearby(m);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setNearbyDone(true);
      });
    return () => ctrl.abort();
  }, [coords, on]);

  const sorted = useMemo(() => {
    if (!coords) return results;
    return [...results].sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
  }, [results, coords]);
  const nearbySorted = useMemo(() => {
    if (!coords) return [] as PlaceResult[];
    return [...nearby].sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
  }, [nearby, coords]);
  const showNearby = needle.length < 2;
  // Loading is derived, never stored: nearby is pending until located + fetched;
  // a search is pending until its results are the ones for the current query.
  // While pending we show skeleton cards and hold the near-header so nothing pops.
  const searchPending = !showNearby && searchedNeedle !== needle;
  const list = !on ? [] : showNearby ? nearbySorted : searchPending ? [] : sorted;
  const nearbyLoading = showNearby && !denied && !nearbyDone;
  const showSkeleton = on && (nearbyLoading || searchPending) && list.length === 0;

  return (
    <div className="onb-card">
      {rail}
      <h2>{t.onbGymStep}</h2>
      <p className="lead">{t.onbGymLead}</p>
      {!on ? (
        <GeoOffState />
      ) : (
        <SearchField
          value={q}
          placeholder={t.searchGymPlaceholder}
          clearLabel={t.laClearSearch}
          onChange={setQ}
        />
      )}
      {on && denied && (
        <div className="banner">
          <Icon name="map-pin-slash" />
          <span>{t.locationBlockedBody}</span>
        </div>
      )}
      {on && showNearby && !denied && (list.length > 0 || nearbyLoading) && (
        <div className="onb-near">
          <Icon name="crosshair" />
          <span>{t.onbNearYou(fmtDistance(2000))}</span>
        </div>
      )}
      <div className="onb-gym-list">
        {showSkeleton
          ? Array.from({ length: 3 }, (_, i) => <GymCardSkeleton key={i} />)
          : list.slice(0, 4).map((r) => {
              const d = coords ? haversineM(coords, r) : null;
              return (
                <Card
                  as="button"
                  pad="none"
                  key={r.key}
                  className="onb-gym-card"
                  onClick={() => onPick(r)}
                >
                  <span className="photo">
                    <GymThumb name={r.name} lat={r.lat} lng={r.lng} size={120} />
                  </span>
                  <span className="body">
                    <span className="n">{r.name}</span>
                    <span className="s">
                      {r.address ?? ''}
                      {d !== null ? `${r.address ? ' · ' : ''}${fmtDistance(d)}` : ''}
                    </span>
                  </span>
                </Card>
              );
            })}
      </div>
      <Button variant="link" onClick={() => onPick(null)}>
        {t.onbSkipGym}
      </Button>
    </div>
  );
}
