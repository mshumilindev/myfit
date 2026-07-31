/** Progress — design S-34…S-36. */
import { useState } from 'react';
import { est1rm, topSet, workoutVolumeKg, type useStore } from '../store';
import { useT } from '../i18n';
import { EmptyState, LanguageSelector } from '../ui';

type Store = ReturnType<typeof useStore>;

const WEEK_MS = 7 * 24 * 3600 * 1000;

function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function ProgressView({ store }: { store: Store }) {
  const { t } = useT();
  const [nowTs] = useState(() => Date.now());
  const finished = store.workouts.filter((w) => w.finishedAt !== null);

  if (finished.length < 3) {
    return (
      <div className="screen">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingTop: 8,
          }}
        >
          <h1 className="headline" style={{ margin: 0 }}>
            {t.progress}
          </h1>
          <LanguageSelector />
        </div>
        <EmptyState
          icon="chart-line-up"
          title={t.twoMoreSessions}
          body={t.progressLocked(finished.length)}
        />
        <div className="unlock">
          <span style={{ flex: 1 }}>{t.progressUnlocksAt}</span>
          <span className="dots">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < finished.length ? 'on' : ''} />
            ))}
          </span>
        </div>
      </div>
    );
  }

  // Weekly volume, current week last, 10 columns.
  const thisWeek = weekStart(nowTs);
  const weeks: number[] = [];
  for (let i = 9; i >= 0; i--) {
    const start = thisWeek - i * WEEK_MS;
    weeks.push(
      finished
        .filter((w) => weekStart(w.startedAt) === start)
        .reduce((v, w) => v + workoutVolumeKg(w), 0),
    );
  }
  const maxWeek = Math.max(...weeks, 1);
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const deltaPct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const barColors = [
    'var(--color-neutral-800)',
    'var(--color-neutral-800)',
    'var(--color-neutral-800)',
    'var(--color-neutral-800)',
    'var(--color-neutral-800)',
    'var(--color-accent-800)',
    'var(--color-accent-700)',
    'var(--color-accent-700)',
    'var(--color-accent-600)',
    'var(--color-accent)',
  ];

  // Exercise stats: records + 1RM series for the two most frequent lifts.
  const byName = new Map<
    string,
    { count: number; recW: number; recReps: number; lastTs: number; recTs: number }
  >();
  for (const w of finished) {
    for (const e of w.exercises) {
      const key = e.name.trim();
      if (!key) continue;
      const top = topSet(e.sets);
      if (!top || (top.weight ?? 0) === 0) continue;
      const cur = byName.get(key) ?? { count: 0, recW: 0, recReps: 0, lastTs: 0, recTs: 0 };
      cur.count++;
      cur.lastTs = Math.max(cur.lastTs, w.startedAt);
      if ((top.weight ?? 0) > cur.recW) {
        cur.recW = top.weight ?? 0;
        cur.recReps = top.reps;
        cur.recTs = w.startedAt;
      }
      byName.set(key, cur);
    }
  }
  const ranked = [...byName.entries()].sort((a, b) => b[1].count - a[1].count);
  const lines = ranked.slice(0, 2).map(([name]) => {
    const pts: { ts: number; rm: number }[] = [];
    for (const w of [...finished].reverse()) {
      const e = w.exercises.find((x) => x.name.trim() === name);
      const top = e && topSet(e.sets);
      if (top && (top.weight ?? 0) > 0)
        pts.push({ ts: w.startedAt, rm: est1rm(top.weight ?? 0, top.reps) });
    }
    return { name, pts };
  });

  const records = [...byName.entries()].sort((a, b) => b[1].recW - a[1].recW).slice(0, 3);

  function polyline(pts: { rm: number }[], w: number, h: number): string {
    if (pts.length < 2) return '';
    const min = Math.min(...pts.map((p) => p.rm));
    const max = Math.max(...pts.map((p) => p.rm));
    const span = Math.max(max - min, 1);
    return pts
      .map(
        (p, i) =>
          `${((i / (pts.length - 1)) * (w - 8) + 4).toFixed(1)},${(h - 8 - ((p.rm - min) / span) * (h - 16) + 4).toFixed(1)}`,
      )
      .join(' ');
  }

  return (
    <div className="screen" style={{ gap: 'var(--space-8)' }}>
      <div className="kpi">
        <div>
          <div className="big num">
            {(cur / 1000).toFixed(1)}
            <span className="unit"> t</span>
          </div>
          <div className="lab">{t.volumeThisWeek}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <LanguageSelector />
        </div>
        {deltaPct !== null && (
          <span className="tag tag-accent" style={{ marginBottom: 22 }}>
            {deltaPct >= 0 ? '+' : '−'}
            {Math.abs(deltaPct)}%
          </span>
        )}
      </div>

      <div className="bars">
        {weeks.map((v, i) => (
          <div
            key={i}
            className="bar"
            style={{
              height: `${Math.max((v / maxWeek) * 100, 4)}%`,
              background: barColors[i],
            }}
          />
        ))}
      </div>

      {lines.length > 0 && lines[0].pts.length >= 2 && (
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>
            {t.estimated1rm}
          </div>
          <div className="chart-card">
            <svg viewBox="0 0 300 100" style={{ width: '100%', height: 100, display: 'block' }}>
              <polyline
                points={polyline(lines[0].pts, 300, 100)}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {lines[1] && lines[1].pts.length >= 2 && (
                <polyline
                  points={polyline(lines[1].pts, 300, 100)}
                  fill="none"
                  stroke="var(--color-neutral-700)"
                  strokeWidth="1.5"
                  strokeDasharray="3 4"
                />
              )}
            </svg>
            <div className="chart-legend">
              <span>
                <span className="sw" style={{ background: 'var(--color-accent)' }} />
                {lines[0].name} {lines[0].pts[lines[0].pts.length - 1].rm} kg
              </span>
              {lines[1] && lines[1].pts.length >= 2 && (
                <span>
                  <span className="sw" style={{ background: 'var(--color-neutral-700)' }} />
                  {lines[1].name} {lines[1].pts[lines[1].pts.length - 1].rm} kg
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="section-label" style={{ marginBottom: 4 }}>
          {t.records}
        </div>
        <div>
          {records.map(([name, r]) => {
            const wksAgo = Math.floor((nowTs - r.recTs) / WEEK_MS);
            return (
              <div key={name} className="record-row">
                <span className="n">{name}</span>
                <span className="v">{r.recW} kg</span>
                {wksAgo < 2 ? (
                  <span className="tag tag-accent">{t.record}</span>
                ) : (
                  <span className="when num">{t.wksAgo(wksAgo)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
