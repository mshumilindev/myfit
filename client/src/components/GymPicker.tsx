/**
 * "Which gym?" picker — a styled panel with per-gym image, distance, and
 * today's hours, plus a search filter. Suggests the nearest saved gym by GPS
 * (else the first). Two variants: `sheet` (standalone, e.g. starting a session)
 * and `inline` (a dropdown embedded in a form, e.g. the backfill sheet — this
 * avoids nesting a Sheet inside a Sheet, which mis-positioned before).
 */
import { useEffect, useMemo, useState } from 'react';
import type { Gym } from '../types';
import { getCurrentPositionOnce } from '../store';
import {
  haversineM,
  fmtDistance,
  resolveGymMeta,
  parseOpeningHours,
  type Coords,
} from '../data/gymProviders';
import { useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import { GymThumb } from './GymThumb';

/** Nearest-within-radius → nearest overall → first saved. */
export function suggestGymId(gyms: Gym[], coords: Coords | null): string | null {
  if (coords && gyms.length) {
    const byDist = gyms.map((g) => ({ g, d: haversineM(coords, g) })).sort((a, b) => a.d - b.d);
    const inRadius = byDist.find((x) => x.d <= x.g.radiusM);
    if (inRadius) return inRadius.g.id;
    if (byDist[0]) return byDist[0].g.id;
  }
  return gyms[0]?.id ?? null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/** Compact today's-hours line for a picker row (open dot + range). */
function RowHours({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const { t } = useT();
  const [today, setToday] = useState<{ open: boolean | null; label: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const sig = new AbortController().signal;
    resolveGymMeta(lat, lng, sig, name)
      .then((meta) => {
        if (!alive || !meta) return;
        const parsed = meta.hours ?? parseOpeningHours(meta.openingHours);
        if (!parsed) return;
        const d = new Date();
        const idx = (d.getDay() + 6) % 7;
        const nowMin = d.getHours() * 60 + d.getMinutes();
        const ranges = parsed.week[idx];
        const inRange = (r: [number, number]) =>
          r[1] > r[0] ? nowMin >= r[0] && nowMin < r[1] : nowMin >= r[0] || nowMin < r[1];
        // Compute from the hours in local time — the provider's openNow is a
        // cached snapshot (up to 7 days old) and goes stale, e.g. at 02:30.
        const open = ranges.some(inRange);
        const label = ranges.length
          ? ranges.map((r) => `${hhmm(r[0])}–${hhmm(r[1])}`).join(', ')
          : t.gymDayClosed;
        setToday({ open, label });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name, lat, lng, t]);
  if (!today) return null;
  return (
    <span className={`row-hours${today.open ? ' open' : ''}`}>
      <span className="hdot" />
      {today.label}
    </span>
  );
}

export function GymPicker({
  gyms,
  title,
  variant = 'sheet',
  onPick,
  onClose,
}: {
  gyms: Gym[];
  title: string;
  variant?: 'sheet' | 'inline';
  onPick: (gymId: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    getCurrentPositionOnce()
      .then((p) => alive && setCoords({ lat: p.lat, lng: p.lng }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(() => {
    const list = [...gyms];
    if (coords) list.sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
    return list;
  }, [gyms, coords]);
  const suggested = useMemo(() => suggestGymId(gyms, coords), [gyms, coords]);
  const needle = q.trim().toLowerCase();
  const filtered = needle ? sorted.filter((g) => g.name.toLowerCase().includes(needle)) : sorted;

  const body = (
    <>
      <div className="sheet-head">
        <span className="t">{title}</span>
      </div>
      {gyms.length > 4 && (
        <div className="searchbar sm">
          <Icon name="magnifying-glass" />
          <input
            value={q}
            placeholder={t.searchGymPlaceholder}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
      <div className="gym-pick-list">
        {filtered.map((g) => {
          const d = coords ? haversineM(coords, g) : null;
          const isSug = g.id === suggested && !needle;
          return (
            <button
              key={g.id}
              className={`gym-pick-row${isSug ? ' suggested' : ''}`}
              onClick={() => onPick(g.id)}
            >
              <span className="thumb">
                <GymThumb name={g.name} lat={g.lat} lng={g.lng} size={44} />
              </span>
              <span className="body">
                <span className="n">{g.name}</span>
                <span className="s">
                  {isSug && d !== null && d <= g.radiusM
                    ? t.pickGymHere
                    : d !== null
                      ? fmtDistance(d)
                      : ''}
                  <RowHours name={g.name} lat={g.lat} lng={g.lng} />
                </span>
              </span>
              {isSug && <span className="tag tag-accent">{t.pickGymSuggested}</span>}
            </button>
          );
        })}
        <button className="gym-pick-row none" onClick={() => onPick(null)}>
          <span className="thumb">
            <Icon name="map-pin-slash" />
          </span>
          <span className="body">
            <span className="n">{t.pickGymSkip}</span>
          </span>
        </button>
      </div>
    </>
  );

  if (variant === 'inline') return <div className="gym-pick-inline">{body}</div>;
  return <Sheet onClose={onClose}>{body}</Sheet>;
}
