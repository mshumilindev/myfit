/**
 * Challenges — the hub you start goals from and track them in. Everything is
 * local and derived (see challenges.ts): the catalog is generated, progress is
 * read from history. Four surfaces live here so the feature is self-contained
 * and needs no extra app routing: the hub (active rings + a searchable,
 * filterable catalog), the start sheet (target stepper + duration), the detail
 * (big ring + by-day strip + give up), and the completion celebration. Works
 * full-width on mobile and in the desktop content column.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmtDayMonth, useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import type { StoreState } from '../store';
import {
  challengeCatalog,
  challengeCtx,
  challengeProgress,
  fmtChallengeValue,
  fmtChallengeDuration,
  giveUpChallenge,
  isReach,
  markCelebrated,
  markChallengeDone,
  startChallenge,
  templateById,
  useChallenges,
  CHALLENGE_CATEGORIES,
  type ActiveChallenge,
  type ChallengeCategory,
  type ChallengeProgress,
  type ChallengeTemplate,
} from '../challenges';

const ACCENT_CLASS: Record<string, string> = {
  brass: 'acc-brass',
  ok: 'acc-ok',
  blue: 'acc-blue',
};

/** SVG progress ring. `size` drives the geometry; stroke scales with it. */
function Ring({
  pct,
  size,
  stroke,
  children,
}: {
  pct: number;
  size: number;
  stroke: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  const gid = `chg-${size}`;
  return (
    <div className="ch-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ch-ring-svg">
        <circle cx={size / 2} cy={size / 2} r={r} className="ch-ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ch-ring-fill"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          stroke={`url(#${gid})`}
        />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-accent-700, #8a642e)" />
            <stop offset="1" stopColor="var(--color-accent-200, #e4bb76)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ch-ring-mid">{children}</div>
    </div>
  );
}

interface LiveChallenge {
  ac: ActiveChallenge;
  tmpl: ChallengeTemplate;
  prog: ChallengeProgress;
}

export function ChallengesView({ store }: { store: StoreState }) {
  const { t } = useT();
  const [now] = useState(() => Date.now());
  const activeRaw = useChallenges();
  const catalog = challengeCatalog();

  const ctx = useMemo(
    () => challengeCtx(store, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.workouts, store.activities, store.bodyMetrics, store.restPeriods, now],
  );

  // Resolve each started challenge to its template + live progress.
  const live: LiveChallenge[] = useMemo(() => {
    const out: LiveChallenge[] = [];
    for (const ac of activeRaw) {
      const tmpl = templateById(ac.templateId);
      if (!tmpl) continue;
      out.push({ ac, tmpl, prog: challengeProgress(ac, tmpl, ctx) });
    }
    return out;
  }, [activeRaw, ctx]);

  // Mark newly-finished challenges done (side effect kept out of render).
  useEffect(() => {
    for (const l of live)
      if (l.ac.status === 'active' && l.prog.done) markChallengeDone(l.ac.id, now);
  }, [live, now]);

  // Celebrate the first done-but-uncelebrated challenge.
  const celebrate = live.find((l) => l.ac.status === 'done' && !l.ac.celebrated) ?? null;

  const activeList = live.filter((l) => l.ac.status === 'active');
  const startedIds = new Set(activeList.map((l) => l.tmpl.id));
  const doneIds = new Set(live.filter((l) => l.ac.status === 'done').map((l) => l.tmpl.id));

  // Catalog filter + search.
  const [cat, setCat] = useState<ChallengeCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.filter((c) => {
      if (cat !== 'all' && c.category !== cat) return false;
      if (!needle) return true;
      const hay =
        `${c.title(t, c.target)} ${c.keywords} ${t.chCat[c.category] ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [catalog, cat, q, t]);

  const [startTmpl, setStartTmpl] = useState<ChallengeTemplate | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId ? (live.find((l) => l.ac.id === detailId) ?? null) : null;

  // Catalog paging (20 per page) + a filter sheet, like the exercise library.
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const applyCat = (c: ChallengeCategory | 'all') => {
    setCat(c);
    setPage(0);
  };
  const applyQuery = (v: string) => {
    setQ(v);
    setPage(0);
  };
  const PAGE = 20;
  const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE) - 1);
  const curPage = Math.min(page, maxPage);
  const shown = filtered.slice(curPage * PAGE, curPage * PAGE + PAGE);

  const activeCount = activeList.length;

  return (
    <div className="ch-screen">
      <div className="ch-head">
        <h2 className="title-26">{t.challengesTitle}</h2>
        {activeCount > 0 && <span className="ch-count">{t.chNActive(activeCount)}</span>}
      </div>

      <div className="ch-body">
        {activeList.length > 0 && (
          <section className="ch-sect">
            <div className="ch-sect-label">{t.chActive}</div>
            <div className="ch-active-list">
              {activeList.map((l) => (
                <ActiveCard key={l.ac.id} l={l} onOpen={() => setDetailId(l.ac.id)} />
              ))}
            </div>
          </section>
        )}

        <section className="ch-sect">
          <div className="ch-sect-label">{t.chStartSection}</div>

          <div className="ch-searchrow">
            <div className="ch-search">
              <Icon name="magnifying-glass" />
              <input
                value={q}
                onChange={(e) => applyQuery(e.target.value)}
                placeholder={t.chSearchPlaceholder}
                aria-label={t.chSearchPlaceholder}
              />
              {q && (
                <button
                  className="ch-search-clear"
                  onClick={() => applyQuery('')}
                  aria-label={t.clearLabel}
                >
                  <Icon name="x" />
                </button>
              )}
            </div>
            <button
              className={`ch-funnel${cat !== 'all' ? ' on' : ''}`}
              onClick={() => setShowFilters(true)}
              aria-label={t.libFiltersLabel}
            >
              <Icon name="funnel-simple" />
            </button>
          </div>

          {cat !== 'all' && (
            <div className="ch-active-filter">
              <button className="ch-fchip" onClick={() => applyCat('all')}>
                {t.chCat[cat]}
                <Icon name="x" />
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="ch-empty">{t.chSearchEmpty}</div>
          ) : (
            <>
              <div className="ch-catalog">
                {shown.map((c) => (
                  <CatalogRow
                    key={c.id}
                    c={c}
                    state={startedIds.has(c.id) ? 'active' : doneIds.has(c.id) ? 'done' : 'idle'}
                    onStart={() => setStartTmpl(c)}
                  />
                ))}
              </div>
              {maxPage > 0 && (
                <nav className="exl-pager" aria-label={t.pagination}>
                  <button
                    className="exl-pagebtn"
                    disabled={curPage === 0}
                    onClick={() => setPage(curPage - 1)}
                    aria-label={t.pagePrev}
                  >
                    <Icon name="caret-left" />
                  </button>
                  {Array.from({ length: maxPage + 1 }, (_, p) => (
                    <button
                      key={p}
                      className={`exl-pagenum${p === curPage ? ' active' : ''}`}
                      aria-current={p === curPage ? 'page' : undefined}
                      onClick={() => setPage(p)}
                    >
                      {p + 1}
                    </button>
                  ))}
                  <button
                    className="exl-pagebtn"
                    disabled={curPage >= maxPage}
                    onClick={() => setPage(curPage + 1)}
                    aria-label={t.pageNext}
                  >
                    <Icon name="caret-left" className="flip" />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      {showFilters && (
        <Sheet onClose={() => setShowFilters(false)} className="ch-filter-sheet">
          <div className="sheet-head with-back">
            <button
              className="sheet-back"
              onClick={() => setShowFilters(false)}
              aria-label={t.backAction}
            >
              <Icon name="caret-left" />
            </button>
            <span className="t">{t.libFiltersLabel}</span>
          </div>
          <div className="ch-filter-chips">
            <button
              className={cat === 'all' ? 'active' : ''}
              onClick={() => {
                applyCat('all');
                setShowFilters(false);
              }}
            >
              {t.chFilterAll}
            </button>
            {CHALLENGE_CATEGORIES.map((c) => (
              <button
                key={c}
                className={cat === c ? 'active' : ''}
                onClick={() => {
                  applyCat(c);
                  setShowFilters(false);
                }}
              >
                {t.chCat[c]}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {startTmpl && (
        <StartSheet
          tmpl={startTmpl}
          onClose={() => setStartTmpl(null)}
          onStart={(target, days) => {
            const ac = startChallenge(startTmpl.id, target, days, now);
            setStartTmpl(null);
            setDetailId(ac.id);
          }}
        />
      )}

      {detail && (
        <DetailSheet
          l={detail}
          onClose={() => setDetailId(null)}
          onGiveUp={() => {
            giveUpChallenge(detail.ac.id);
            setDetailId(null);
          }}
        />
      )}

      {celebrate && (
        <CompleteSheet
          l={celebrate}
          onDone={() => {
            markCelebrated(celebrate.ac.id);
            setDetailId(null);
          }}
        />
      )}
    </div>
  );
}

// --- Active card -------------------------------------------------------------

function ActiveCard({ l, onOpen }: { l: LiveChallenge; onOpen: () => void }) {
  const { t } = useT();
  const { tmpl, prog } = l;
  const endedUndone = prog.ended && !prog.done;
  const unit = t.chUnit[tmpl.unit] ?? tmpl.unit;
  return (
    <button className={`ch-active ${ACCENT_CLASS[tmpl.accent]}`} onClick={onOpen}>
      <Ring pct={prog.pct} size={58} stroke={5}>
        <Icon name={tmpl.icon} weight="bold" />
      </Ring>
      <div className="ch-active-main">
        <div className="ch-active-title">{tmpl.title(t, prog.target)}</div>
        <div className="ch-active-sub">
          <span className="ch-active-val">{fmtChallengeValue(tmpl.unit, prog.value, t)}</span>
          {' / '}
          {fmtChallengeValue(tmpl.unit, prog.target, t)} {unit}
          {' · '}
          {endedUndone ? t.chEnded : t.chDaysLeft(prog.daysLeft)}
        </div>
      </div>
      <span className="ch-pct num">{Math.round(prog.pct * 100)}%</span>
      <Icon name="caret-right" className="ch-go" />
    </button>
  );
}

// --- Catalog row -------------------------------------------------------------

function CatalogRow({
  c,
  state,
  onStart,
}: {
  c: ChallengeTemplate;
  state: 'idle' | 'active' | 'done';
  onStart: () => void;
}) {
  const { t } = useT();
  return (
    <div className={`ch-cat-row ${ACCENT_CLASS[c.accent]}`}>
      <div className="ch-cat-ic">
        <Icon name={c.icon} weight="fill" />
      </div>
      <div className="ch-cat-main">
        <div className="ch-cat-title">{c.title(t, c.target)}</div>
        <div className="ch-cat-sub">{t.chCat[c.category]}</div>
      </div>
      {/* One round chip, three states: start (plus), in-progress (clock), done (check). */}
      {state === 'active' ? (
        <span
          className="ch-cat-chip ch-chip-active"
          role="img"
          aria-label={t.chActive}
          title={t.chActive}
        >
          <Icon name="clock" weight="bold" />
        </span>
      ) : state === 'done' ? (
        <span
          className="ch-cat-chip ch-chip-done"
          role="img"
          aria-label={t.chDone}
          title={t.chDone}
        >
          <Icon name="check" weight="bold" />
        </span>
      ) : (
        <button
          className="ch-cat-chip ch-chip-start"
          onClick={onStart}
          aria-label={t.chStart}
          title={t.chStart}
        >
          <Icon name="plus" weight="bold" />
        </button>
      )}
    </div>
  );
}

// --- Start sheet -------------------------------------------------------------

function StartSheet({
  tmpl,
  onClose,
  onStart,
}: {
  tmpl: ChallengeTemplate;
  onClose: () => void;
  onStart: (target: number, days: number) => void;
}) {
  const { t } = useT();
  const [target, setTarget] = useState(tmpl.target);
  const [days, setDays] = useState(tmpl.durations[0]);
  const adjustable = tmpl.max > tmpl.min;
  const unit = t.chUnit[tmpl.unit] ?? tmpl.unit;

  const dec = () => setTarget((v) => Math.max(tmpl.min, Math.round((v - tmpl.step) * 100) / 100));
  const inc = () => setTarget((v) => Math.min(tmpl.max, Math.round((v + tmpl.step) * 100) / 100));

  return (
    <Sheet onClose={onClose} className="ch-start-sheet">
      <div className="ch-sheet-head">
        <div className={`ch-sheet-ic ${ACCENT_CLASS[tmpl.accent]}`}>
          <Icon name={tmpl.icon} weight="fill" />
        </div>
        <div>
          <div className="ch-sheet-title">{tmpl.title(t, target)}</div>
          <div className="ch-sheet-cat">{t.chCat[tmpl.category]}</div>
        </div>
      </div>

      <p className="ch-sheet-blurb">{tmpl.blurb(t)}</p>

      {adjustable && (
        <>
          <div className="ch-field-label">
            {t.chTarget} — {unit}
          </div>
          <div className="ch-stepper">
            <button className="ch-step" onClick={dec} disabled={target <= tmpl.min} aria-label="−">
              <Icon name="minus" />
            </button>
            <div className="ch-step-val num">{fmtChallengeValue(tmpl.unit, target, t)}</div>
            <button
              className="ch-step plus"
              onClick={inc}
              disabled={target >= tmpl.max}
              aria-label="+"
            >
              <Icon name="plus" />
            </button>
          </div>
        </>
      )}

      {tmpl.durations.length > 1 && (
        <>
          <div className="ch-field-label">{t.chDuration}</div>
          <div className="ch-segmented">
            {tmpl.durations.map((d) => (
              <button key={d} className={d === days ? 'active' : ''} onClick={() => setDays(d)}>
                {fmtChallengeDuration(d, t)}
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-primary ch-start-cta" onClick={() => onStart(target, days)}>
        {t.chStartCta}
      </button>
    </Sheet>
  );
}

// --- Detail sheet ------------------------------------------------------------

function DetailSheet({
  l,
  onClose,
  onGiveUp,
}: {
  l: LiveChallenge;
  onClose: () => void;
  onGiveUp: () => void;
}) {
  const { t, locale } = useT();
  const { tmpl, ac, prog } = l;
  const [confirm, setConfirm] = useState(false);
  const unit = t.chUnit[tmpl.unit] ?? tmpl.unit;
  const endedUndone = prog.ended && !prog.done;
  const pace = fmtChallengeValue(
    tmpl.unit,
    Math.max(0, Math.round(prog.perDayNeeded * 10) / 10),
    t,
  );

  return createPortal(
    <div className="ch-scrim ch-scrim-full" onClick={onClose}>
      <div className="ch-detail" onClick={(e) => e.stopPropagation()}>
        <div className="ch-detail-top">
          <button className="back" onClick={onClose} aria-label={t.backAction}>
            <Icon name="caret-left" />
          </button>
          <span className="ch-detail-kick">{t.chCat[tmpl.category]}</span>
          <span style={{ width: 22 }} />
        </div>

        <div className="ch-detail-body">
          <div className="ch-detail-title">{tmpl.title(t, prog.target)}</div>
          <div className="ch-detail-when">
            {endedUndone
              ? t.chEnded
              : `${t.chDaysLeft(prog.daysLeft)} · ${t.chEndsOn(fmtDayMonth(ac.endsAt, locale))}`}
          </div>

          <Ring pct={prog.pct} size={200} stroke={12}>
            <div className="ch-big-num num">
              {fmtChallengeValue(tmpl.unit, prog.value, t)}
              <span className="ch-big-den">/{fmtChallengeValue(tmpl.unit, prog.target, t)}</span>
            </div>
            <div className="ch-big-lab">
              {Math.round(prog.pct * 100)}% · {unit}
            </div>
          </Ring>

          <p className="ch-detail-blurb">
            {tmpl.blurb(t)}{' '}
            {!prog.done &&
              !endedUndone &&
              (isReach(tmpl.metric) ? (
                <span className="ch-pace">{t.chReachPace}</span>
              ) : (
                <span className="ch-pace">{t.chPace(pace)}</span>
              ))}
          </p>

          <ByDay cells={prog.byDay} />
        </div>

        <div className="ch-detail-foot">
          {confirm ? (
            <div className="ch-confirm">
              <span>{t.chGiveUpConfirm}</span>
              <div className="ch-confirm-row">
                <button className="ch-confirm-no" onClick={() => setConfirm(false)}>
                  {t.cancel}
                </button>
                <button className="ch-confirm-yes" onClick={onGiveUp}>
                  {t.chGiveUp}
                </button>
              </div>
            </div>
          ) : (
            <button className="ch-giveup" onClick={() => setConfirm(true)}>
              {t.chGiveUp}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The BY DAY strip — recent days shaded by activity, 7 to a row. */
function ByDay({ cells }: { cells: { ts: number; intensity: number; state: string }[] }) {
  const { t } = useT();
  if (cells.length === 0) return null;
  return (
    <div className="ch-byday">
      <div className="ch-byday-label">{t.chByDay}</div>
      <div className="ch-byday-grid">
        {cells.map((c, i) => (
          <div
            key={i}
            className={`ch-day st-${c.state}`}
            style={c.state !== 'future' ? { opacity: 0.28 + c.intensity * 0.72 } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// --- Completion --------------------------------------------------------------

function CompleteSheet({ l, onDone }: { l: LiveChallenge; onDone: () => void }) {
  const { t } = useT();
  const { tmpl, ac, prog } = l;
  const days = Math.max(
    1,
    Math.round(((ac.completedAt ?? ac.startedAt) - ac.startedAt) / (24 * 3600 * 1000)),
  );
  const valueLabel = `${fmtChallengeValue(tmpl.unit, prog.target, t)} ${t.chUnit[tmpl.unit] ?? tmpl.unit}`;

  return createPortal(
    <div className="ch-scrim ch-scrim-full">
      <div className="ch-complete">
        <div className="ch-confetti" aria-hidden>
          {CONFETTI.map((c, i) => (
            <span key={i} style={c} />
          ))}
        </div>
        <div className="ch-trophy">
          <Icon name="trophy" weight="fill" />
        </div>
        <div className="ch-complete-kick">{t.chComplete}</div>
        <div className="ch-complete-title">{tmpl.title(t, prog.target)}</div>
        <div className="ch-complete-body">{t.chCompleteBody(valueLabel, days)}</div>
        <div className="ch-complete-actions">
          <button className="btn btn-primary" onClick={onDone}>
            {t.chDone}
          </button>
        </div>
        <div className="ch-complete-note">
          <Icon name="bell" />
          {t.chPostedToNotifs}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const CONFETTI: React.CSSProperties[] = [
  { left: '15%', top: '18%', transform: 'rotate(20deg)' },
  { right: '17%', top: '15%', transform: 'rotate(-15deg)' },
  { left: '25%', top: '27%' },
  { right: '24%', top: '30%', transform: 'rotate(35deg)' },
  { left: '34%', top: '13%' },
  { right: '33%', top: '23%', transform: 'rotate(-25deg)' },
];
