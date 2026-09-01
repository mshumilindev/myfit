/** Feats tab (in Progress): achievements across many axes, derived from history. */
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, computeFeats, fmtAchValue, type Ach, type FeatGroup } from '../feats';
import type { BodyMetrics, Workout } from '../types';
import { fmtDayMonth, useT } from '../i18n';
import { EmptyState } from '../ui';
import { StandardsView } from './StandardsView';

const TILE = 150; // target tile width (px)
const GAP = 12;

/** Number of tiles that fit across the given container width. */
function fitCols(width: number): number {
  if (!width) return 6;
  return Math.max(3, Math.min(11, Math.floor((width + GAP) / (TILE + GAP))));
}

type Popup = { group: FeatGroup; kind: 'prev' | 'up' } | null;

export function FeatsView({
  finished,
  body,
  sub,
  onSub,
}: {
  finished: Workout[];
  body: BodyMetrics;
  sub: 'achievements' | 'standards';
  onSub: (s: 'achievements' | 'standards') => void;
}) {
  const { t, locale } = useT();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [popup, setPopup] = useState<Popup>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(6);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setCols(fitCols(entries[0].contentRect.width)));
    ro.observe(el);
    setCols(fitCols(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const r = computeFeats(finished);

  if (finished.length === 0) {
    return <EmptyState icon="barbell" title={t.featsEmptyTitle} body={t.featsEmptyBody} />;
  }

  const allAch = Object.values(r.byGroup).flat();
  const open = openKey ? (allAch.find((a) => a.key === openKey) ?? null) : null;
  const openCat = open ? CATEGORIES.find((c) => c.group === open.group) : null;
  const popCat = popup ? CATEGORIES.find((c) => c.group === popup.group) : null;
  const popList = (() => {
    if (!popup) return [];
    const list = r.byGroup[popup.group];
    const frontier = list.findIndex((a) => !a.unlocked);
    const allUnlocked = frontier === -1;
    if (popup.kind === 'prev') return allUnlocked ? list : list.slice(0, frontier);
    // 'up' — the far-future tiers computed the same way as the row below.
    return upcomingFor(list, cols);
  })();

  // Keep the popup mounted underneath the detail — closing the detail returns
  // to the list rather than dumping straight back to the section.
  const openTile = (a: Ach) => setOpenKey(a.key);

  const Tile = ({ a, current }: { a: Ach; current?: boolean }) => (
    <button
      id={`feat-${a.key}`}
      className={`feat-cell${a.unlocked ? ' on' : ' ghost'}${current ? ' current' : ''}`}
      onClick={() => openTile(a)}
    >
      <span className="feat-emoji">{a.emoji}</span>
      <span className="feat-name">{a.title}</span>
      {current && (
        <span className="feat-prog">
          <span className="feat-prog-fill" style={{ width: `${Math.round(a.progress * 100)}%` }} />
        </span>
      )}
    </button>
  );

  const subTabs = (
    <div className="exg-tabs feat-subtabs" role="tablist">
      <button
        role="tab"
        aria-selected={sub === 'achievements'}
        className={sub === 'achievements' ? 'active' : ''}
        onClick={() => onSub('achievements')}
      >
        {t.featsAchievements}
      </button>
      <button
        role="tab"
        aria-selected={sub === 'standards'}
        className={sub === 'standards' ? 'active' : ''}
        onClick={() => onSub('standards')}
      >
        {t.featsStandards}
      </button>
    </div>
  );

  if (sub === 'standards') {
    return (
      <div className="feats-wrap">
        {subTabs}
        <StandardsView finished={finished} body={body} />
      </div>
    );
  }

  return (
    <div className="feats-wrap">
      {subTabs}
      <div className="feats" ref={wrapRef}>
        <div className="feats-head">
          <span className="feats-count num">{t.featsOf(r.unlockedCount, r.total)}</span>
        </div>

        {r.nextUp && (
          <div className="feats-nextup">
            <div className="fn-emoji">{r.nextUp.emoji}</div>
            <div className="fn-body">
              <div className="fn-name">{r.nextUp.title}</div>
              <div className="fn-sub">{t.featsNextMilestone}</div>
              <div className="fn-track">
                <div
                  className="fn-fill"
                  style={{ width: `${Math.round(r.nextUp.progress * 100)}%` }}
                />
              </div>
              <div className="fn-foot">
                <span className="num">{fmtAchValue(r.nextUp.unit, r.nextUp.value)}</span>
                <span>
                  {t.featsToGo(
                    fmtAchValue(r.nextUp.unit, Math.max(0, r.nextUp.threshold - r.nextUp.value)),
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {CATEGORIES.map((cat) => {
          const list = r.byGroup[cat.group];
          const unlocked = list.filter((a) => a.unlocked).length;
          const frontier = list.findIndex((a) => !a.unlocked);
          const allUnlocked = frontier === -1;
          const prevCount = allUnlocked ? list.length : frontier;
          const hasPrev = prevCount > 0;
          const locked = allUnlocked ? [] : list.slice(frontier);

          // Fit [prev block] + middle tiles + [upcoming block] into exactly `cols`.
          const slots = cols - (hasPrev ? 1 : 0);
          let middleN = slots;
          if (locked.length > middleN) {
            middleN = slots - 1;
          }
          if (middleN < 0) middleN = 0;
          const middle = locked.slice(0, middleN);
          const upCount = locked.length - middle.length;
          const hasUpcoming = upCount > 0;

          return (
            <section key={cat.group} className="feats-section">
              <div className="feats-section-head">
                <span className="fs-label">{cat.label}</span>
                <span className="fs-count num">
                  {unlocked}/{list.length}
                </span>
              </div>
              <div className="feats-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {hasPrev && (
                  <button
                    className="feat-block earned"
                    onClick={() => setPopup({ group: cat.group, kind: 'prev' })}
                  >
                    <span className="fb-num num">{prevCount}</span>
                    <span className="fb-lab">{allUnlocked ? t.featsAllDone : t.featsEarned}</span>
                  </button>
                )}
                {middle.map((a, i) => (
                  <Tile key={a.key} a={a} current={i === 0} />
                ))}
                {hasUpcoming && (
                  <button
                    className="feat-block upcoming"
                    onClick={() => setPopup({ group: cat.group, kind: 'up' })}
                  >
                    <span className="fb-num num">+{upCount}</span>
                    <span className="fb-lab">{t.featsUpcoming}</span>
                  </button>
                )}
              </div>
            </section>
          );
        })}

        {/* Earned / Upcoming list popup */}
        {popup && popCat && (
          <div className="feat-scrim" onClick={() => setPopup(null)}>
            <div className="feat-listpop" onClick={(e) => e.stopPropagation()}>
              <div className="flp-head">
                <span className="flp-title">
                  {popCat.label} · {popup.kind === 'prev' ? t.featsEarned : t.featsUpcoming}
                </span>
                <span className="flp-count num">{popList.length}</span>
              </div>
              <div className="flp-grid">
                {popList.map((a) => (
                  <button
                    key={a.key}
                    className={`feat-cell${a.unlocked ? ' on' : ' ghost'}`}
                    onClick={() => openTile(a)}
                  >
                    <span className="feat-emoji">{a.emoji}</span>
                    <span className="feat-name">{a.title}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={() => setPopup(null)}>
                {t.featsClose}
              </button>
            </div>
          </div>
        )}

        {/* Single-achievement detail — sits above the list popup when both are open */}
        {open && openCat && (
          <div className="feat-scrim feat-scrim-top" onClick={() => setOpenKey(null)}>
            <div className="feat-detail" onClick={(e) => e.stopPropagation()}>
              <div className="fd-emoji">{open.emoji}</div>
              <div className="fd-name">{open.title}</div>
              {openCat.desc && <p className="fd-explain">{openCat.desc}</p>}
              {open.unlocked ? (
                open.unlockAt && (
                  <span className="feat-badge ok">
                    {t.featsUnlocked(fmtDayMonth(open.unlockAt, locale))}
                  </span>
                )
              ) : (
                <span className="feat-badge todo">
                  {t.featsToGo(fmtAchValue(open.unit, Math.max(0, open.threshold - open.value)))}
                </span>
              )}
              <div className="fd-rows">
                <div className="fd-row">
                  <span>{openCat.label}</span>
                  <b className="num">{fmtAchValue(open.unit, open.value)}</b>
                </div>
                <div className="fd-row ghost">
                  <span>{t.featsNext}</span>
                  <b className="num">{fmtAchValue(open.unit, open.threshold)}</b>
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setOpenKey(null)}>
                {t.featsClose}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The locked tiers that spill past the inline middle window (for the popup). */
function upcomingFor(list: Ach[], cols: number): Ach[] {
  const frontier = list.findIndex((a) => !a.unlocked);
  if (frontier === -1) return [];
  const hasPrev = frontier > 0;
  const locked = list.slice(frontier);
  const slots = cols - (hasPrev ? 1 : 0);
  let middleN = slots;
  if (locked.length > middleN) middleN = slots - 1;
  if (middleN < 0) middleN = 0;
  return locked.slice(middleN);
}
