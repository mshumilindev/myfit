/**
 * Log activity — the full page that replaced the old type-picker drawer
 * (design docs/design/log-activity: m01–m08 mobile, w01–w04 web ≥720px).
 *
 *   • always-visible, sticky search (names in every locale + synonyms, with an
 *     "as Other sport" fallback);
 *   • "Likely now" hero from the user's own weekday/time pattern, or "Up next"
 *     right after a log, with one-tap Start / Log and smaller suggestions;
 *   • Pinned row (account-synced pins; long-press on mobile, drag & drop on web);
 *   • Browse by category → the category page with in-category search + pins;
 *   • Quick-log as a bottom sheet (mobile) or a sticky side panel (web);
 *   • live state: resume banner, starting locked, past logs still allowed;
 *   • first-time state: friendly hero, popular starters, pin hint.
 *
 * The per-activity page (ActivityView) still owns the live timer and editing.
 */
import { withFirst } from '../accountOverrides';
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import type { Shell } from '../App';
import {
  deleteActivity,
  finishActivity,
  latestWeight,
  liveSleep,
  logActivity,
  placePin,
  setActivityPins,
  startActivity,
  togglePin,
  useActivityPins,
  useStore,
  workoutSets,
} from '../store';
import {
  ACTIVITY_TYPES,
  activityElapsedMs,
  activityType,
  durationMin,
  estimateCalories,
  isActivityPaused,
} from '../activities';
import {
  dayLoad,
  dayStart,
  followerOf,
  lastLoggedByType,
  suggestActivities,
  type LikelyNow,
  type Suggestion,
  type UpNext,
} from '../activitySuggest';
import { searchActivities, type SearchHit } from '../activitySearch';
import { fmtDayMonth, fmtWeekdayShort, LOCALE_IDS, LOCALES, useT, type LocaleId } from '../i18n';
import type { Strings } from '../i18n/en';
import { haptic } from '../haptics';
import { Icon, Sheet, useIsDesktop } from '../ui';
import { isoWeekday } from '../weekStart';
import type { Activity } from '../types';
import { QuickLog } from './logActivity/QuickLog';
import { CategoryRow } from '../components/ui/CategoryRow';
import { PinToggle } from '../components/ui/PinToggle';
import { Snackbar } from '../components/ui/Snackbar';
import {
  CATS,
  catKitTone,
  catName,
  catOf,
  catTone,
  catTypes,
  clock,
  fmtApprox,
  fmtDur,
  fmtKm,
  hhmm,
  KIT_OF,
  minToHhmm,
  nowMs,
  lastMeta,
  readLocal,
  relDay,
  toneClass,
  typeIcon,
  typeName,
  useNow,
  writeLocal,
  type CatId,
} from './logActivity/shared';
import './LogActivity.css';

const HIDE_KEY = 'spotter.la.hidden';
const QUEUE_KEY = 'spotter.la.queued';
const STARTERS = ['run', 'walk', 'yoga', 'tennis'];
const CAT_EXAMPLES: Record<CatId, string[]> = {
  conditioning: ['run', 'walk', 'cycle'],
  sport: ['tennis', 'football', 'padel'],
  recovery: ['yoga', 'sauna', 'mobility'],
};

interface QuickState {
  key: string;
  note?: string | null;
  minutes?: number;
}
interface SnackMsg {
  id: number;
  text: string;
  sub?: string;
  tone: string;
  undo?: () => void;
  undoAria?: string;
}

export function LogActivityView({
  shell,
  cat,
  onClose,
}: {
  shell: Shell;
  cat?: CatId;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  // The account's "always first" types lead the pinned row (accountOverrides.ts).
  const pinsRaw = useActivityPins();
  const pins = useMemo(() => withFirst(pinsRaw), [pinsRaw]);
  const web = useIsDesktop();

  const openW = store.workouts.find((w) => w.finishedAt === null) ?? null;
  const liveAct = store.activities.find((a) => a.finishedAt === null) ?? null;
  const sleepLive = liveSleep(store.sleeps);
  const now = useNow(!!liveAct);
  const locked = !!openW || !!liveAct || !!sleepLive;
  const liveName = openW
    ? openW.dayName || t.laWorkoutLive
    : liveAct
      ? typeName(liveAct.type, t)
      : sleepLive
        ? t.sleepTitle
        : '';
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;

  const [query, setQuery] = useState('');
  const [catQuery, setCatQuery] = useState('');
  const [quick, setQuick] = useState<QuickState | null>(null);
  const [snack, setSnack] = useState<SnackMsg | null>(null);
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>(() => {
    const v = readLocal<{ day: number; types: string[] } | null>(HIDE_KEY, null);
    return v && v.day === dayStart(Date.now()) ? v.types : [];
  });
  const [queued, setQueued] = useState<string | null>(() => {
    const v = readLocal<{ type: string; liveId: string } | null>(QUEUE_KEY, null);
    return v && v.liveId === liveAct?.id ? v.type : null;
  });
  const [expanded, setExpanded] = useState<CatId | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [todayOpen, setTodayOpen] = useState(false);
  const [pinNote, setPinNote] = useState<{ key: string; pinned: boolean; prev: string[] } | null>(
    null,
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ timer: number | null; fired: boolean }>({ timer: null, fired: false });
  const snackSeq = useRef(0);

  const nowMinute = Math.floor(now / 60_000) * 60_000;
  const suggest = useMemo(
    () => suggestActivities(store.activities, nowMinute, { exclude: hidden }),
    [store.activities, nowMinute, hidden],
  );
  const lastBy = useMemo(() => lastLoggedByType(store.activities), [store.activities]);
  const lastAt = useMemo(
    () => new Map([...lastBy].map(([k, a]) => [k, a.startedAt] as [string, number])),
    [lastBy],
  );
  const otherNames = useMemo(() => LOCALE_IDS.map((id) => LOCALES[id].actType), []);
  const weekday = isoWeekday(now);
  const todayStart = dayStart(now);
  const todayActs = store.activities
    .filter((a) => a.finishedAt !== null && a.startedAt >= todayStart)
    .sort((a, b) => b.startedAt - a.startedAt);
  const todayWorkouts = store.workouts.filter(
    (w) => w.startedAt >= todayStart && w.finishedAt !== null,
  );
  const liftMin = Math.round(
    todayWorkouts.reduce((s, w) => s + ((w.finishedAt ?? now) - w.startedAt) / 60_000, 0),
  );
  const follower = liveAct ? followerOf(store.activities, liveAct.type, now) : null;
  const firstTime = !suggest.hasHistory;

  // Snackbar auto-dismiss (5 s, like the app's undo snackbar).
  useEffect(() => {
    if (!snack) return;
    const to = window.setTimeout(() => setSnack(null), 5000);
    return () => window.clearTimeout(to);
  }, [snack]);
  useEffect(() => {
    if (!pinNote) return;
    const to = window.setTimeout(() => setPinNote(null), 5000);
    return () => window.clearTimeout(to);
  }, [pinNote]);

  // --- actions -----------------------------------------------------------------------
  function showSnack(m: Omit<SnackMsg, 'id'>): void {
    snackSeq.current += 1;
    setSnack({ ...m, id: snackSeq.current });
  }
  function openQuick(key: string, opts: Omit<QuickState, 'key'> = {}): void {
    if (!activityType(key)) return;
    setQuick({ key, ...opts });
  }
  function afterLogged(a: Activity): void {
    setQuick(null);
    setJustLogged(a.id);
    const name = a.note && a.type === 'sport' ? a.note : typeName(a.type, t);
    showSnack({
      text: t.laLoggedToast(name, fmtDur(durationMin(a), t)),
      sub: a.category === 'recovery' ? t.laAddedToRecovery : t.laAddedToLoad,
      tone: toneClass(a.type),
      undo: () => deleteActivity(a.id),
      undoAria: t.laUndoAria(name),
    });
    haptic('success');
  }
  function oneTapLog(key: string, minutes: number): void {
    const type = activityType(key);
    if (!type || minutes <= 0) return;
    const end = nowMs();
    const effort = lastBy.get(key)?.effort ?? 'moderate';
    afterLogged(
      logActivity({
        type: key,
        category: type.category,
        startedAt: end - minutes * 60_000,
        finishedAt: end,
        durationMin: minutes,
        calories: estimateCalories(type, minutes, bodyKg, effort),
        effort,
      }),
    );
  }
  function startNow(key: string): void {
    const type = activityType(key);
    if (!type || locked) return;
    if (!startActivity(type.key, type.category)) return;
    shell.replaceOverlay({ screen: 'activity' });
  }
  function resumeLive(): void {
    if (openW) shell.openOverlay({ screen: 'session', workoutId: openW.id });
    else if (liveAct) shell.openOverlay({ screen: 'activity' });
    else if (sleepLive) shell.openOverlay({ screen: 'sleep' });
  }
  function finishLive(): void {
    if (!liveAct) return;
    const type = activityType(liveAct.type);
    const mins = activityElapsedMs(liveAct, nowMs()) / 60_000;
    const kcal = type ? estimateCalories(type, mins, bodyKg, liveAct.effort ?? 'moderate') : null;
    const done = finishActivity(liveAct.id, { calories: kcal });
    if (done) {
      showSnack({
        text: t.laFinishedToast(typeName(done.type, t), fmtDur(durationMin(done), t)),
        sub: done.category === 'recovery' ? t.laAddedToRecovery : t.laAddedToLoad,
        tone: toneClass(done.type),
      });
    }
    if (queued) {
      openQuick(queued, { minutes: follower?.type === queued ? follower.medianMin : undefined });
      setQueued(null);
      writeLocal(QUEUE_KEY, null);
    }
  }
  function toggleQueue(key: string): void {
    if (!liveAct) return;
    const next = queued === key ? null : key;
    setQueued(next);
    writeLocal(QUEUE_KEY, next ? { type: next, liveId: liveAct.id } : null);
  }
  function hideHero(key: string): void {
    const next = [...hidden, key];
    setHidden(next);
    writeLocal(HIDE_KEY, { day: dayStart(nowMs()), types: next });
  }
  function pin(key: string): void {
    const prev = pins;
    const nowPinned = togglePin(key);
    if (web) setPinNote({ key, pinned: nowPinned, prev });
  }
  function pinFeedback(key: string, prev: string[], list: string[]): void {
    showSnack({
      text: t.laPinnedToast(typeName(key, t), list.indexOf(key) + 1),
      tone: toneClass(key),
      undo: () => setActivityPins(prev),
    });
  }
  function clearPress(): void {
    if (press.current.timer) window.clearTimeout(press.current.timer);
    press.current.timer = null;
  }
  /** Tap → quick-log; mobile long-press → pin/unpin (m01 "Hold any card to pin"). */
  function tapProps(key: string, onTap: () => void) {
    if (web)
      return {
        onClick: onTap,
        draggable: true,
        onDragStart: (e: DragEvent) => {
          e.dataTransfer.setData('text/plain', key);
          e.dataTransfer.effectAllowed = 'copyMove';
          setDrag(key);
        },
        onDragEnd: () => {
          setDrag(null);
          setDropIdx(null);
        },
      };
    return {
      onPointerDown: () => {
        press.current.fired = false;
        clearPress();
        press.current.timer = window.setTimeout(() => {
          press.current.fired = true;
          haptic('tick');
          togglePin(key);
        }, 550);
      },
      onPointerUp: clearPress,
      onPointerLeave: clearPress,
      onPointerCancel: clearPress,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      onClick: () => {
        if (press.current.fired) {
          press.current.fired = false;
          return;
        }
        onTap();
      },
    };
  }
  function goCat(c: CatId | null): void {
    setCatQuery('');
    shell.replaceOverlay(c ? { screen: 'log-activity', cat: c } : { screen: 'log-activity' });
  }

  // --- drag & drop onto the Pinned row (web, w04) ------------------------------------
  const others = drag ? pins.filter((k) => k !== drag) : pins;
  function zoneOver(e: DragEvent<HTMLDivElement>): void {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = pins.includes(drag) ? 'move' : 'copy';
    const cards = [...(zoneRef.current?.querySelectorAll<HTMLElement>('[data-pin]') ?? [])].filter(
      (el) => el.dataset.pin !== drag,
    );
    let idx = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) {
        idx = i;
        break;
      }
    }
    if (idx !== dropIdx) setDropIdx(idx);
  }
  function zoneLeave(e: DragEvent<HTMLDivElement>): void {
    const to = e.relatedTarget as Node | null;
    if (!to || !zoneRef.current?.contains(to)) setDropIdx(null);
  }
  function zoneDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    const key = drag ?? e.dataTransfer.getData('text/plain');
    const idx = dropIdx ?? others.length;
    setDrag(null);
    setDropIdx(null);
    if (!key || !activityType(key)) return;
    const prev = pins;
    placePin(key, idx);
    const list = [...others];
    list.splice(idx, 0, key);
    if (!prev.includes(key)) pinFeedback(key, prev, list);
  }
  const dropHint =
    drag && dropIdx !== null
      ? dropIdx === 0
        ? others.length
          ? t.laDropFirst
          : t.laDropToPin
        : dropIdx >= others.length
          ? t.laDropAfter(typeName(others[others.length - 1], t))
          : t.laDropBetween(typeName(others[dropIdx - 1], t), typeName(others[dropIdx], t))
      : null;

  // --- shared pieces -----------------------------------------------------------------
  const hits: SearchHit[] = query.trim()
    ? searchActivities(query, { names: t.actType, otherNames, pinned: pins, lastAt })
    : [];

  const snackEl = snack && (
    <Snackbar
      tone={KIT_OF[snack.tone] ?? 'accent'}
      text={snack.text}
      sub={snack.sub}
      action={
        snack.undo
          ? {
              label: t.undo,
              ariaLabel: snack.undoAria,
              onClick: () => {
                snack.undo?.();
                setSnack(null);
              },
            }
          : undefined
      }
    />
  );

  const liveBanner = locked && (
    <LiveBanner
      t={t}
      name={liveName}
      icon={liveAct ? typeIcon(liveAct.type) : openW ? 'barbell' : 'moon-stars'}
      tone={liveAct ? toneClass(liveAct.type) : openW ? 'la-g' : 'la-r'}
      since={liveAct ? liveAct.startedAt : openW ? openW.startedAt : (sleepLive?.bedtime ?? now)}
      elapsed={
        liveAct
          ? activityElapsedMs(liveAct, now)
          : openW
            ? now - openW.startedAt
            : now - (sleepLive?.bedtime ?? now)
      }
      paused={!!liveAct && isActivityPaused(liveAct)}
      onResume={resumeLive}
      onFinish={liveAct ? finishLive : null}
    />
  );

  const lockbar = locked && (
    <div className="la-lockbar" role="note">
      <span className="la-tc-g">
        <Icon name="lock-simple" />
      </span>
      <span>
        <b>{t.startFinishFirst(liveName)}</b> {t.laLockNote}
      </span>
    </div>
  );

  const searchField = (
    <div className={`la-search${query ? ' on' : ''}`} role="search">
      <label htmlFor="la-q" className="la-search-ic">
        <Icon name="magnifying-glass" />
        <span className="la-vh">{t.laSearch}</span>
      </label>
      <input
        id="la-q"
        ref={searchRef}
        type="search"
        placeholder={t.laSearch}
        value={query}
        aria-controls="la-res"
        onChange={(e) => setQuery(e.target.value)}
      />
      {query ? (
        <button
          type="button"
          className="la-clr"
          aria-label={t.laClearSearch}
          onClick={() => {
            setQuery('');
            searchRef.current?.focus();
          }}
        >
          <Icon name="x" />
        </button>
      ) : (
        web && <span className="la-search-n">{t.laAllTypes(ACTIVITY_TYPES.length)}</span>
      )}
    </div>
  );

  const results = (
    <>
      <div className="la-sec tight">
        <h2 className="la-lbl" aria-live="polite">
          {t.laMatches(hits.length)} <span className="la-cnt">{t.laForQuery(query.trim())}</span>
        </h2>
        <span className="la-hint">{t.laPinnedRecentFirst}</span>
      </div>
      {hits.length > 0 && (
        <div className="la-res" id="la-res" role="list">
          {hits.map((h) => (
            <ResultRow
              key={h.key}
              hit={h}
              t={t}
              name={typeName(h.key, t)}
              last={lastBy.get(h.key)}
              pinned={pins.includes(h.key)}
              now={now}
              locale={locale}
              drag={web ? tapProps(h.key, () => openQuick(h.key)) : null}
              onOpen={() => openQuick(h.key)}
              onPin={() => pin(h.key)}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        className="la-fb"
        aria-label={t.laLogAsOther(query.trim())}
        onClick={() => openQuick('sport', { note: query.trim() })}
      >
        <span className="la-ico n36 neutral">
          <Icon name="plus" />
        </span>
        <span className="la-fb-t">
          <span className="la-rn">{t.laLogAsOther(query.trim())}</span>
          <span className="la-rm">{t.laLogAsOtherSub}</span>
        </span>
        <Icon name="caret-right" className="la-faint" />
      </button>
    </>
  );

  const hero = suggest.hero;
  const heroEl =
    !liveAct && hero ? (
      <HeroCard
        hero={hero}
        web={web}
        t={t}
        locale={locale}
        weekday={weekday}
        locked={locked}
        onStart={() => startNow(hero.type)}
        onLog={() => oneTapLog(hero.type, hero.medianMin)}
        onHide={() => hideHero(hero.type)}
      />
    ) : !liveAct && firstTime ? (
      <FirstHero t={t} />
    ) : null;

  const alsoCards = !liveAct ? suggest.also : [];
  const doneFor = (s: Suggestion) => todayActs.find((a) => a.type === s.type);

  const todayStrip = !web && todayActs.length > 0 && (
    <section className="la-today" aria-labelledby="la-td">
      <div className="la-trow head">
        <h2 className="la-lbl" id="la-td">
          {t.today}{' '}
          <span className="la-cnt">
            {t.laTodayCount(
              `${fmtWeekdayShort(now, locale)} ${fmtDayMonth(now, locale)}`,
              todayActs.length,
            )}
          </span>
        </h2>
        {liftMin > 0 && <span className="la-muted12">{t.laPlusLifting(liftMin)}</span>}
      </div>
      {todayActs.map((a) => {
        const name = a.note && a.type === 'sport' ? a.note : typeName(a.type, t);
        const kcal = a.calories ?? null;
        const sub = [
          t.actEffortLevel[a.effort ?? 'moderate'],
          `${hhmm(a.startedAt)}–${hhmm(a.finishedAt ?? a.startedAt)}`,
          kcal ? `≈ ${kcal} ${t.kcalShort}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <button
            key={a.id}
            type="button"
            className={`la-trow item ${toneClass(a.type)}`}
            aria-label={t.laEditAria(`${name}, ${fmtDur(durationMin(a), t)}, ${sub}`)}
            onClick={() => shell.openOverlay({ screen: 'activity', editId: a.id })}
          >
            <span className="la-ico n36">
              <Icon name={typeIcon(a.type)} />
            </span>
            <span className="la-grow">
              <span className="la-row-g8">
                <span className="la-cn">
                  {name} · {fmtDur(durationMin(a), t)}
                </span>
                {a.id === justLogged && <span className="la-new">{t.laJustNow}</span>}
              </span>
              <span className="la-cm">{sub}</span>
            </span>
            <Icon name="caret-right" className="la-faint" />
          </button>
        );
      })}
    </section>
  );

  // Pinned row ---------------------------------------------------------------------
  const pinnedMobile = (
    <>
      <div className="la-sec">
        <h2 className="la-lbl">
          {t.laPinned} <span className="la-cnt">{pins.length}</span>
        </h2>
        {pins.length > 0 && (
          <span className="la-hint">
            {!liveAct && <Icon name="push-pin" />}
            {locked ? t.laTapLogPast : t.laHoldToPin}
          </span>
        )}
      </div>
      {pins.length > 0 ? (
        <div className="la-row la-row-wrap">
          {pins.map((k) => {
            const isLive = liveAct?.type === k;
            const last = lastBy.get(k);
            const meta = isLive
              ? t.laLive(clock(activityElapsedMs(liveAct, now)))
              : locked
                ? t.laLogPast
                : last
                  ? relDay(last.startedAt, now, t, locale)
                  : t.laNotYet;
            return (
              <button
                key={k}
                type="button"
                className={`la-pcard ${toneClass(k)}${isLive ? ' live-on' : locked ? ' dim' : ''}`}
                aria-label={
                  isLive
                    ? t.laLiveAria(typeName(k, t), clock(activityElapsedMs(liveAct, now)))
                    : locked
                      ? t.laLockedAria(typeName(k, t), liveName)
                      : t.laPinnedAria(
                          typeName(k, t),
                          last ? relDay(last.startedAt, now, t, locale) : '',
                        )
                }
                {...tapProps(k, () => (isLive ? resumeLive() : openQuick(k)))}
              >
                <span className="la-ico n32">
                  <Icon name={typeIcon(k)} />
                </span>
                <span className="la-pc-t">
                  <span className="la-cn">{typeName(k, t)}</span>
                  <span className={`la-cm${isLive ? ' la-tc-g' : ''}`}>{meta}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <PinHint t={t} />
      )}
    </>
  );

  const pinnedWeb = (
    <>
      <div className="la-sec">
        <div className="la-lbl">
          {t.laPinned} <span className="la-cnt">{pins.length}</span>
        </div>
        <span className={`la-hint${dropHint ? ' drop' : ''}`}>
          <Icon name="push-pin" />
          {dropHint ?? t.laDragHint}
        </span>
      </div>
      <div
        ref={zoneRef}
        className={`la-pinzone${drag ? ' drop' : ''}`}
        role="list"
        aria-label={t.laPinnedList}
        onDragOver={zoneOver}
        onDragEnter={zoneOver}
        onDragLeave={zoneLeave}
        onDrop={zoneDrop}
      >
        {(() => {
          const out: ReactNode[] = [];
          let oi = 0;
          for (const k of pins) {
            const isDragged = k === drag;
            if (!isDragged && dropIdx !== null && oi === dropIdx)
              out.push(<span key="ins" className="la-ins" aria-hidden="true" />);
            const nudge = !isDragged && dropIdx !== null && oi >= dropIdx;
            if (!isDragged) oi++;
            const last = lastBy.get(k);
            const isLive = liveAct?.type === k;
            out.push(
              <div
                key={k}
                role="listitem"
                data-pin={k}
                className={`la-pinc ${toneClass(k)}${isDragged ? ' origin' : ''}${nudge ? ' nudge' : ''}${isLive ? ' live-on' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', k);
                  e.dataTransfer.effectAllowed = 'move';
                  setDrag(k);
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setDropIdx(null);
                }}
              >
                <span className="la-grip" title={t.laDragToReorder}>
                  <Icon name="dots-six" />
                </span>
                <button
                  type="button"
                  className="la-pinb"
                  aria-label={t.laPinnedAria(
                    typeName(k, t),
                    last ? lastMeta(last, now, t, locale, { distanceFirst: true }) : '',
                  )}
                  onClick={() => (isLive ? resumeLive() : openQuick(k))}
                >
                  <span className="la-ico n34">
                    <Icon name={typeIcon(k)} />
                  </span>
                  <span className="la-grow">
                    <span className="la-cn sm">{typeName(k, t)}</span>
                    <span className="la-cm xs">
                      {isLive
                        ? t.laLive(clock(activityElapsedMs(liveAct, now)))
                        : last
                          ? lastMeta(last, now, t, locale, { distanceFirst: true })
                          : t.laNotYet}
                    </span>
                  </span>
                </button>
                <PinToggle
                  pinned
                  tone="accent"
                  label={t.laUnpin(typeName(k, t))}
                  onToggle={() => pin(k)}
                  className="la-pint"
                />
              </div>,
            );
          }
          if (dropIdx !== null && dropIdx >= oi)
            out.push(<span key="ins" className="la-ins" aria-hidden="true" />);
          return out;
        })()}
        <div className={`la-pslot${drag ? ' drop' : ''}`} aria-hidden="true">
          {drag ? (
            t.laDropToPin
          ) : (
            <>
              <Icon name="plus" />
              {t.laDragHere}
            </>
          )}
        </div>
      </div>
    </>
  );

  // Browse by category --------------------------------------------------------------
  function catMeta(c: CatId): { text: string; minis: string[] } {
    const keys = catTypes(c).map((x) => x.key);
    const logged = keys
      .filter((k) => lastBy.has(k))
      .sort((a, b) => (lastAt.get(b) ?? 0) - (lastAt.get(a) ?? 0));
    const minis = [...logged, ...CAT_EXAMPLES[c], ...keys].filter(
      (k, i, arr) => arr.indexOf(k) === i,
    );
    if (firstTime || !logged.length)
      return {
        text: `${CAT_EXAMPLES[c].map((k) => typeName(k, t)).join(', ')}…`,
        minis,
      };
    const k = logged[0];
    const when = relDay(lastAt.get(k) ?? now, now, t, locale);
    return { text: t.laLastShort(`${typeName(k, t)} · ${when}`), minis };
  }

  const catRows = (
    <nav className="la-clist" aria-label={t.laBrowse}>
      {CATS.map((c) => {
        const n = catTypes(c).length;
        const meta = catMeta(c);
        const selKey = web && quick && catOf(quick.key) === c ? quick.key : null;
        const text = selKey
          ? t.laOpenInQuick(typeName(selKey, t))
          : locked && !web
            ? t.laLogPastOnly
            : meta.text;
        const row = (
          <CategoryRow
            tone={catKitTone(c)}
            icon={catIcon(c)}
            title={catName(c, t)}
            count={n}
            layout={web ? 'inline' : 'stack'}
            selected={!!selKey}
            muted={locked && !web}
            chevron={!web}
            minis={meta.minis.map((k) => typeIcon(k))}
            ariaLabel={t.laCatAria(catName(c, t), n, text)}
            meta={
              <>
                {locked && !web && <Icon name="lock-simple" />}
                {text}
              </>
            }
            onClick={() => goCat(c)}
          />
        );
        if (!web) return <Fragment key={c}>{row}</Fragment>;
        const open = expanded === c;
        const tiles = catTypes(c)
          .map((x) => x.key)
          .sort(
            (a, b) =>
              (lastAt.get(b) ?? 0) - (lastAt.get(a) ?? 0) ||
              typeName(a, t).localeCompare(typeName(b, t)),
          )
          .slice(0, 6);
        return (
          <div key={c} className={`la-cwrap ${catTone(c)}${open ? ' la-cexp' : ''}`}>
            <div className="la-crow-line">
              {row}
              <button
                type="button"
                className="la-cexp-btn"
                aria-expanded={open}
                aria-label={open ? t.laHideTypes : t.laShowTypes}
                onClick={() => setExpanded(open ? null : c)}
              >
                <Icon name={open ? 'caret-down' : 'caret-right'} />
              </button>
            </div>
            {open && (
              <>
                <div className="la-tgrid">
                  {tiles.map((k) => (
                    <div
                      key={k}
                      className={`la-tile2 ${toneClass(k)}${drag === k ? ' origin' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label={t.laQuickLogAria(typeName(k, t))}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          openQuick(k);
                        }
                      }}
                      {...tapProps(k, () => openQuick(k))}
                    >
                      <span className="la-grip">
                        <Icon name="dots-six" />
                      </span>
                      <span className="la-ico n34">
                        <Icon name={typeIcon(k)} />
                      </span>
                      <span className="la-grow">
                        <span className="la-cn sm">{typeName(k, t)}</span>
                        <span className="la-cm xs">
                          {lastBy.get(k) ? lastMeta(lastBy.get(k), now, t, locale) : t.laNotYet}
                        </span>
                      </span>
                      <PinToggle
                        pinned={pins.includes(k)}
                        tone="accent"
                        label={
                          pins.includes(k) ? t.laUnpin(typeName(k, t)) : t.laPin(typeName(k, t))
                        }
                        onToggle={() => pin(k)}
                        className="la-pint"
                      />
                    </div>
                  ))}
                </div>
                <div className="la-cexp-foot">
                  <span>{t.laDragOrClick}</span>
                  <button type="button" className="la-see" onClick={() => goCat(c)}>
                    {t.laAllCatN(catTypes(c).length, catName(c, t))} ›
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </nav>
  );

  // Suggestions ----------------------------------------------------------------------
  function sugMeta(s: Suggestion): string {
    return s.reason === 'after' && s.after
      ? t.laAfterX(typeName(s.after, t), s.count, s.of)
      : t.laBandCount(t.laBandPlural[s.band], s.count, s.of);
  }
  const alsoMobile = alsoCards.length > 0 && (
    <>
      <div className="la-sec">
        <h2 className="la-lbl">{t.laAlsoOn(weekday)}</h2>
      </div>
      <div className="la-sugs">
        {alsoCards.map((s) => {
          const done = s.doneAt != null ? doneFor(s) : undefined;
          const name = typeName(s.type, t);
          const dur = done ? fmtDur(durationMin(done), t) : fmtApprox(s.medianMin, t);
          return (
            <button
              key={s.type}
              type="button"
              className={`la-sug ${toneClass(s.type)}${done ? ' done' : ''}`}
              aria-label={done ? t.laDoneAria(name) : t.laLogAria(name, dur)}
              onClick={() => (done ? undefined : oneTapLog(s.type, s.medianMin))}
            >
              <span className="la-sug-top">
                <span className="la-ico n36">
                  <Icon name={typeIcon(s.type)} />
                </span>
                <span className="la-sug-act">
                  {done ? (
                    <>
                      <Icon name="check" />
                      {t.laDone}
                    </>
                  ) : (
                    t.laPlusLog
                  )}
                </span>
              </span>
              <span className="la-sn">
                {name} · {s.reason === 'band' && !done ? '~' : ''}
                {dur}
              </span>
              <span className="la-sm">
                {done ? t.laLoggedAt(hhmm(done.finishedAt ?? done.startedAt)) : sugMeta(s)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
  const alsoWeb = alsoCards.length > 0 && (
    <div className="la-also-col">
      <div className="la-lbl">{t.laAlsoOn(weekday)}</div>
      {alsoCards.map((s) => {
        const done = s.doneAt != null ? doneFor(s) : undefined;
        const name = typeName(s.type, t);
        const dur = done ? fmtDur(durationMin(done), t) : fmtApprox(s.medianMin, t);
        return (
          <div key={s.type} className={`la-mini-row ${toneClass(s.type)}${done ? ' done' : ''}`}>
            <span className="la-ico n34">
              <Icon name={typeIcon(s.type)} />
            </span>
            <span className="la-grow">
              <span className="la-cn sm ell">
                {name} · {dur}
              </span>
              <span className="la-cm">
                {done ? t.laLoggedAt(hhmm(done.finishedAt ?? done.startedAt)) : sugMeta(s)}
              </span>
            </span>
            {done ? (
              <span className="la-sug-act">
                <Icon name="check" />
                {t.laDone}
              </span>
            ) : (
              <button
                type="button"
                className="la-ob sm tone"
                aria-label={t.laLogAria(name, dur)}
                onClick={() => oneTapLog(s.type, s.medianMin)}
              >
                {t.laPlusLog}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const queueCard = liveAct && follower && (
    <>
      <div className="la-sec">
        <h2 className="la-lbl">{t.laAfterUsually(typeName(liveAct.type, t))}</h2>
        <span className="la-hint">{t.laFromLastDays(suggest.weeks || follower.of, weekday)}</span>
      </div>
      <div className="la-sugs one">
        <button
          type="button"
          className={`la-sug row ${toneClass(follower.type)}`}
          aria-pressed={queued === follower.type}
          onClick={() => toggleQueue(follower.type)}
        >
          <span className="la-ico n36">
            <Icon name={typeIcon(follower.type)} />
          </span>
          <span className="la-grow">
            <span className="la-sn">
              {typeName(follower.type, t)} · {fmtApprox(follower.medianMin, t)}
            </span>
            <span className="la-sm">{t.laOfferedOnFinish(follower.count, follower.of)}</span>
          </span>
          <span className="la-sug-act">{queued === follower.type ? t.laQueued : t.laQueue}</span>
        </button>
      </div>
    </>
  );

  const starters = firstTime && (
    <>
      <div className="la-sec">
        <h2 className="la-lbl">{t.laPopular}</h2>
        <span className="la-hint">{t.laTapToLog}</span>
      </div>
      <div className={web ? 'la-also-col' : 'la-sugs gap8'}>
        {STARTERS.map((k) => (
          <div key={k} className={`la-st ${toneClass(k)}`}>
            <button
              type="button"
              className="la-stb"
              aria-label={t.laQuickLogAria(typeName(k, t))}
              {...tapProps(k, () => openQuick(k))}
            >
              <span className="la-ico n36">
                <Icon name={typeIcon(k)} />
              </span>
              <span className="la-grow">
                <span className="la-cn">{typeName(k, t)}</span>
                <span className="la-cm">{t.laStarterSub[k]}</span>
              </span>
            </button>
            <PinBtn k={k} pinned={pins.includes(k)} t={t} onPin={() => pin(k)} />
          </div>
        ))}
      </div>
    </>
  );

  // --- Category page -------------------------------------------------------------------
  if (cat) {
    const types = catTypes(cat);
    const keys = types.map((x) => x.key);
    const q = catQuery.trim();
    const filtered = q
      ? searchActivities(q, { names: t.actType, otherNames, keys, pinned: pins, lastAt }).map(
          (h) => h.key,
        )
      : null;
    const recent = keys
      .filter((k) => lastBy.has(k))
      .sort((a, b) => (lastAt.get(b) ?? 0) - (lastAt.get(a) ?? 0));
    const az = (a: string, b: string) => typeName(a, t).localeCompare(typeName(b, t));
    const lastInCat = recent[0];
    const lastInCatAt = lastInCat ? (lastAt.get(lastInCat) ?? now) : null;
    const weeksAgo = lastInCatAt ? Math.floor((now - lastInCatAt) / (7 * 86_400_000)) : 0;
    const catLast =
      lastInCat && lastInCatAt
        ? t.laLastShort(
            `${typeName(lastInCat, t)} · ${
              weeksAgo >= 2 ? t.laWeeksAgo(weeksAgo) : relDay(lastInCatAt, now, t, locale)
            }`,
          )
        : null;
    const tile = (k: string) => {
      const last = lastBy.get(k);
      const isPinned = pins.includes(k);
      const meta = last ? lastMeta(last, now, t, locale) : k === 'sport' ? t.laNameIt : t.laNotYet;
      return (
        <div key={k} className={`la-tile ${toneClass(k)}${isPinned ? ' on' : ''}`}>
          <button
            type="button"
            className="la-tb"
            aria-label={`${typeName(k, t)}${last ? `, ${lastMeta(last, now, t, locale)}` : ''}`}
            {...tapProps(k, () => openQuick(k))}
          >
            <span className="la-ico n36">
              <Icon name={typeIcon(k)} />
            </span>
            <span>
              <span className="la-tn">{typeName(k, t)}</span>
              <span className={`la-tm${last ? '' : ' none'}`}>{meta}</span>
            </span>
          </button>
          <PinBtn k={k} pinned={isPinned} t={t} onPin={() => pin(k)} boxed />
        </div>
      );
    };
    const catSearch = (
      <div className={`la-search cat ${catTone(cat)}${catQuery ? ' on' : ''}`} role="search">
        <label htmlFor="la-cq" className="la-search-ic">
          <Icon name="magnifying-glass" />
          <span className="la-vh">{t.laSearchIn[cat]}</span>
        </label>
        <input
          id="la-cq"
          type="search"
          placeholder={t.laSearchIn[cat]}
          value={catQuery}
          onChange={(e) => setCatQuery(e.target.value)}
        />
        {catQuery ? (
          <button
            type="button"
            className="la-clr"
            aria-label={t.laClearSearch}
            onClick={() => setCatQuery('')}
          >
            <Icon name="x" />
          </button>
        ) : (
          web && <span className="la-search-n">{t.laTypes(types.length)}</span>
        )}
      </div>
    );

    if (!web) {
      const grid = filtered ?? [
        ...keys.filter((k) => pins.includes(k)).sort((a, b) => pins.indexOf(a) - pins.indexOf(b)),
        ...keys.filter((k) => !pins.includes(k) && k !== 'sport').sort(az),
        ...(cat === 'sport' && !pins.includes('sport') ? ['sport'] : []),
      ];
      return (
        <div className={`screen la ${catTone(cat)}`}>
          <div className="la-band">
            <button
              type="button"
              className="la-ib tone"
              aria-label={t.laBackToLog}
              onClick={() => goCat(null)}
            >
              <Icon name="caret-left" />
            </button>
            <h1 className="la-ptitle">
              <span className="la-crumb">{t.logActivity}</span>
              <span className="la-row-g10">
                <span className="la-tc">{catName(cat, t)}</span>
                <span className="la-cc" aria-label={t.laTypes(types.length)}>
                  {types.length}
                </span>
              </span>
            </h1>
            <span className="la-ico n44" aria-hidden="true">
              <Icon name={catIcon(cat)} />
            </span>
          </div>
          <div className="la-sticky">{catSearch}</div>
          {!filtered && recent.length > 0 && (
            <>
              <div className="la-sec">
                <h2 className="la-lbl">{t.laRecentIn(catName(cat, t))}</h2>
              </div>
              <div className="la-row">
                {recent.slice(0, 6).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`la-pcard wide ${toneClass(k)}`}
                    aria-label={`${typeName(k, t)}, ${lastMeta(lastBy.get(k), now, t, locale)}`}
                    {...tapProps(k, () => openQuick(k))}
                  >
                    <span className="la-ico n32">
                      <Icon name={typeIcon(k)} />
                    </span>
                    <span className="la-pc-t">
                      <span className="la-cn">{typeName(k, t)}</span>
                      <span className="la-cm">{lastMeta(lastBy.get(k), now, t, locale)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {/* Label and hint on one line; the order note under them, so long
              translations (pl, lt, et) never squeeze each other. */}
          <div className="la-sec la-sec-2l">
            <h2 className="la-lbl la-nowrap">{t.laAllCat[cat]}</h2>
            <span className="la-hint la-nowrap">
              <Icon name="push-pin" />
              {t.laTapToPin}
            </span>
            <span className="la-cnt la-sec-note">{t.laPinnedFirstAZ}</span>
          </div>
          <div className="la-grid">{grid.map((k) => tile(k))}</div>
          <div className="la-pad24" />
          {quick && (
            <Sheet onClose={() => setQuick(null)} className="la-sheet">
              <QuickLog
                key={`${quick.key}:${quick.note ?? ''}`}
                typeKey={quick.key}
                note={quick.note}
                initialMinutes={quick.minutes}
                locked={locked}
                variant="sheet"
                onClose={() => setQuick(null)}
                onLogged={afterLogged}
                onStarted={() => shell.replaceOverlay({ screen: 'activity' })}
              />
            </Sheet>
          )}
          {snackEl}
        </div>
      );
    }

    // Web category page (w03)
    const yours = filtered
      ? filtered
      : keys
          .filter((k) => lastBy.has(k) || pins.includes(k))
          .sort(
            (a, b) =>
              Number(pins.includes(b)) - Number(pins.includes(a)) ||
              (lastAt.get(b) ?? 0) - (lastAt.get(a) ?? 0),
          );
    const rest = filtered
      ? []
      : keys
          .filter((k) => !yours.includes(k))
          .sort((a, b) => (a === 'sport' ? 1 : b === 'sport' ? -1 : az(a, b)));
    return (
      <div className={`screen la la-web ${catTone(cat)}`}>
        <header className="la-wbar">
          <button type="button" className="la-ib" aria-label={t.backAction} onClick={onClose}>
            <Icon name="caret-left" />
          </button>
          <div className="la-grow">
            <div className="la-muted12">{t.logActivity}</div>
            <h1 className="la-wtitle">
              {catName(cat, t)} · {types.length}
            </h1>
          </div>
          <span className="la-wdate">
            {fmtWeekdayShort(now, locale)} {fmtDayMonth(now, locale)} · {hhmm(now)}
          </span>
          <div className="la-wsearch">{catSearch}</div>
        </header>
        <div className="la-cols">
          <div className="la-left">
            <div className="la-cathead">
              <button
                type="button"
                className="la-ib tone"
                aria-label={t.laBackToCats}
                onClick={() => goCat(null)}
              >
                <Icon name="caret-left" />
              </button>
              <div className="la-grow">
                <div className="la-muted12">{t.laCatKicker}</div>
                <div className="la-row-g10 la-mt2">
                  <span className="la-cathead-n">{catName(cat, t)}</span>
                  <span className="la-cc dark">{types.length}</span>
                  {catLast && <span className="la-muted13">{catLast}</span>}
                </div>
              </div>
            </div>
            {pinNote && (
              <div className="la-pinbar" role="status">
                <Icon name="push-pin" weight="fill" />
                <span className="la-grow">
                  {pinNote.pinned
                    ? t.laPinnedToast(typeName(pinNote.key, t), pins.indexOf(pinNote.key) + 1)
                    : t.laUnpinnedToast(typeName(pinNote.key, t))}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActivityPins(pinNote.prev);
                    setPinNote(null);
                  }}
                >
                  {t.undo}
                </button>
              </div>
            )}
            {yours.length > 0 && (
              <>
                <div className="la-sec">
                  <span className="la-lbl">
                    {filtered ? t.laMatches(yours.length) : t.laYourFirst[cat]}
                  </span>
                  <span className="la-hint">
                    <Icon name="push-pin" />
                    {t.laPinToKeep}
                  </span>
                </div>
                <div className="la-grid five">{yours.map((k) => tile(k))}</div>
              </>
            )}
            {rest.length > 0 && (
              <>
                <div className="la-sec">
                  <span className="la-lbl">{t.laAllAZ[cat]}</span>
                  <span className="la-hint">{t.laClickToLog}</span>
                </div>
                <div className="la-grid five">{rest.map((k) => tile(k))}</div>
              </>
            )}
          </div>
          {renderWebPanel()}
        </div>
        {snackEl}
      </div>
    );
  }

  // --- Main page ----------------------------------------------------------------------
  if (!web) {
    return (
      <div className="screen la">
        <div className="la-pbar">
          <button type="button" className="la-ib" aria-label={t.backAction} onClick={onClose}>
            <Icon name="caret-left" />
          </button>
          <h1 className="la-ptitle">{t.logActivity}</h1>
        </div>
        <div className="la-sticky">
          {liveBanner}
          {searchField}
        </div>
        {query.trim() ? (
          results
        ) : (
          <>
            {lockbar}
            {todayStrip}
            {heroEl}
            {queueCard}
            {alsoMobile}
            {starters}
            {pinnedMobile}
            <div className="la-sec">
              <h2 className="la-lbl">{t.laBrowse}</h2>
              <span className="la-hint">
                {locked ? t.laStartLockedPast : t.laTypes(ACTIVITY_TYPES.length)}
              </span>
            </div>
            {catRows}
          </>
        )}
        <div className="la-pad24" />
        {quick && (
          <Sheet onClose={() => setQuick(null)} className="la-sheet">
            <QuickLog
              key={`${quick.key}:${quick.note ?? ''}`}
              typeKey={quick.key}
              note={quick.note}
              initialMinutes={quick.minutes}
              locked={locked}
              variant="sheet"
              onClose={() => setQuick(null)}
              onLogged={afterLogged}
              onStarted={() => shell.replaceOverlay({ screen: 'activity' })}
            />
          </Sheet>
        )}
        {snackEl}
      </div>
    );
  }

  // Web main (w01/w02/w04)
  return (
    <div className="screen la la-web">
      <header className="la-wbar">
        <button type="button" className="la-ib" aria-label={t.backAction} onClick={onClose}>
          <Icon name="caret-left" />
        </button>
        <div className="la-grow">
          <h1 className="la-wtitle">{t.logActivity}</h1>
          <div className="la-muted13">{t.actPickCap}</div>
        </div>
        <span className="la-wdate">
          {fmtWeekdayShort(now, locale)} {fmtDayMonth(now, locale)} · {hhmm(now)}
        </span>
        <div className="la-wsearch">{searchField}</div>
      </header>
      <div className="la-cols">
        <div className="la-left">
          {liveBanner}
          {lockbar}
          {query.trim() ? (
            results
          ) : (
            <>
              {(heroEl || alsoWeb || starters || queueCard) && (
                <div className="la-herogrid">
                  <div>
                    {heroEl}
                    {queueCard}
                  </div>
                  <div>{firstTime ? starters : alsoWeb}</div>
                </div>
              )}
              {pinnedWeb}
              <div className="la-sec">
                <div className="la-lbl">
                  {t.laOrPickCat} <span className="la-cnt">{t.laTypes(ACTIVITY_TYPES.length)}</span>
                </div>
              </div>
              {catRows}
            </>
          )}
        </div>
        {renderWebPanel()}
      </div>
      {snackEl}
    </div>
  );

  // Right-hand Quick-log panel (w01 empty + Today, w02/w03 filled). A closure
  // component (declared as a function so hooks-free rendering can share state).
  function renderWebPanel() {
    const entries = todayWorkouts.length + todayActs.length;
    const minutes = liftMin + Math.round(todayActs.reduce((s, a) => s + durationMin(a), 0));
    const load = dayLoad(store.workouts, store.activities, now);
    const todayList = (
      <>
        {todayWorkouts.map((w) => (
          <div key={w.id} className="la-tl">
            <span className="la-ico n32 neutral">
              <Icon name="barbell" />
            </span>
            <span className="la-grow">
              <span className="la-cn sm">{t.laGymRow(w.dayName || t.laWorkoutLive)}</span>
              <span className="la-cm">
                {fmtDur(((w.finishedAt ?? now) - w.startedAt) / 60_000, t)} ·{' '}
                {t.nSetsTag(workoutSets(w))}
              </span>
            </span>
            <span className="la-muted12">{hhmm(w.startedAt)}</span>
          </div>
        ))}
        {todayActs.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`la-tl ${toneClass(a.type)}`}
            onClick={() => shell.openOverlay({ screen: 'activity', editId: a.id })}
          >
            <span className="la-ico n32">
              <Icon name={typeIcon(a.type)} />
            </span>
            <span className="la-grow">
              <span className="la-row-g8">
                <span className="la-cn sm">
                  {a.note && a.type === 'sport' ? a.note : typeName(a.type, t)}
                </span>
                {a.id === justLogged && <span className="la-new">{t.laJustNow}</span>}
              </span>
              <span className="la-cm">
                {fmtDur(durationMin(a), t)}
                {a.distanceKm ? ` · ${fmtKm(a.distanceKm)} ${t.laKm}` : ''}
              </span>
            </span>
            <span className="la-muted12">{hhmm(a.startedAt)}</span>
          </button>
        ))}
      </>
    );
    return (
      <div className="la-right">
        <aside
          className="la-panel"
          aria-label={quick ? `${t.laQuickLog} · ${typeName(quick.key, t)}` : t.laQuickLog}
        >
          {quick ? (
            <>
              <QuickLog
                key={`${quick.key}:${quick.note ?? ''}`}
                typeKey={quick.key}
                note={quick.note}
                initialMinutes={quick.minutes}
                locked={locked}
                variant="panel"
                onClose={() => setQuick(null)}
                onLogged={afterLogged}
                onStarted={() => shell.replaceOverlay({ screen: 'activity' })}
              />
              {entries > 0 && (
                <div className="la-panel-foot">
                  <div className="la-sec tight">
                    <span className="la-lbl">
                      {t.today} <span className="la-cnt">{t.laLoggedSum(entries, minutes)}</span>
                    </span>
                    <button
                      type="button"
                      className="la-see muted"
                      aria-expanded={todayOpen}
                      onClick={() => setTodayOpen(!todayOpen)}
                    >
                      {todayOpen ? t.laHideList : t.laShow} ›
                    </button>
                  </div>
                  {todayOpen && todayList}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="la-row-sb baseline">
                <div className="la-panel-t">{t.laQuickLog}</div>
                <span className="la-muted12 faint">{t.laStaysOpen}</span>
              </div>
              <div className="la-empty">
                <span className="la-ico n48 neutral">
                  <Icon name="hand-tap" />
                </span>
                <div className="la-empty-t">{t.laPickAnActivity}</div>
                <div className="la-empty-s">{t.laPickHint}</div>
                <div className="la-row-g6">
                  <span className="la-bdg la-g">{t.actConditioning}</span>
                  <span className="la-bdg la-s">{t.actSports}</span>
                  <span className="la-bdg la-r">{t.actRecovery}</span>
                </div>
              </div>
              <div className="la-panel-today">
                <div className="la-sec tight">
                  <span className="la-lbl">
                    {t.today}{' '}
                    <span className="la-cnt">
                      {fmtWeekdayShort(now, locale)} {fmtDayMonth(now, locale)}
                    </span>
                  </span>
                  {entries > 0 && (
                    <span className="la-muted12">{t.laEntries(minutes, entries)}</span>
                  )}
                </div>
                {todayList}
                <div className="la-loadbox">
                  <div className="la-row-sb">
                    <span className="la-muted12">{t.laLoadToday}</span>
                    <b>{t.laLoadLevel[load.level]}</b>
                  </div>
                  <div className="la-loadbar">
                    <div style={{ width: `${Math.round(load.frac * 100)}%` }} />
                  </div>
                  <div className="la-loadhint">
                    {load.recoveryMin > 0
                      ? t.laLoadHintBalanced
                      : load.level === 'light'
                        ? t.laLoadHintLight
                        : t.laLoadHintRec}
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    );
  }
}

function catIcon(c: CatId): string {
  return c === 'sport' ? 'trophy' : c === 'recovery' ? 'flower-lotus' : 'heartbeat';
}

function PinBtn(props: {
  k: string;
  pinned: boolean;
  t: Strings;
  onPin: () => void;
  boxed?: boolean;
}) {
  const name = typeName(props.k, props.t);
  return (
    <PinToggle
      variant={props.boxed ? 'boxed' : 'icon'}
      tone="inherit"
      pinned={props.pinned}
      label={props.pinned ? props.t.laUnpin(name) : props.t.laPin(name)}
      onToggle={props.onPin}
      className={props.boxed ? 'la-pb' : undefined}
    />
  );
}

function PinHint({ t }: { t: Strings }) {
  return (
    <div className="la-pinhint" role="note">
      <span className="la-ico n36 neutral gold">
        <Icon name="push-pin" />
      </span>
      <span>
        {t.laPinHintTap}{' '}
        <span className="la-pi" role="img" aria-label={t.laPinIcon}>
          <Icon name="push-pin" />
        </span>{' '}
        {t.laPinHintRest}
      </span>
    </div>
  );
}

function ResultRow(props: {
  hit: SearchHit;
  name: string;
  last: Activity | undefined;
  pinned: boolean;
  now: number;
  locale: LocaleId;
  t: Strings;
  drag: object | null;
  onOpen: () => void;
  onPin: () => void;
}) {
  const { hit, name, t } = props;
  const c = catOf(hit.key);
  const nameEl = hit.range ? (
    <>
      {name.slice(0, hit.range[0])}
      <mark>{name.slice(hit.range[0], hit.range[1])}</mark>
      {name.slice(hit.range[1])}
    </>
  ) : (
    name
  );
  const via =
    hit.via && hit.viaRange ? (
      <span className="la-syn">
        “{hit.via.slice(0, hit.viaRange[0])}
        <mark>{hit.via.slice(hit.viaRange[0], hit.viaRange[1])}</mark>
        {hit.via.slice(hit.viaRange[1])}”
      </span>
    ) : null;
  const meta = props.last
    ? t.laResultLast(lastMeta(props.last, props.now, t, props.locale))
    : hit.via
      ? t.laAlsoCovers(hit.via)
      : t.laNotLoggedYet;
  return (
    <div className={`la-rr ${toneClass(hit.key)}`} role="listitem">
      <span className="la-ico n36">
        <Icon name={typeIcon(hit.key)} />
      </span>
      <button
        type="button"
        className="la-rr-b"
        aria-label={`${name}${hit.via ? `, ${hit.via}` : ''}, ${catName(c, t)}, ${meta}`}
        {...(props.drag ?? {})}
        onClick={props.onOpen}
      >
        <span className="la-rn">
          {nameEl}
          {via}
        </span>
        <span className="la-rm">
          <span className={`la-tc ${catTone(c)}`}>{catName(c, t)}</span> · {meta}
        </span>
      </button>
      <PinBtn k={hit.key} pinned={props.pinned} t={t} onPin={props.onPin} />
    </div>
  );
}

function LiveBanner(props: {
  t: Strings;
  name: string;
  icon: string;
  tone: string;
  since: number;
  elapsed: number;
  paused: boolean;
  onResume: () => void;
  onFinish: (() => void) | null;
}) {
  const { t } = props;
  return (
    <section className={`la-live ${props.tone}`} aria-labelledby="la-lv">
      <div className="la-row-g12">
        <span className="la-ico n44">
          <Icon name={props.icon} />
        </span>
        <div className="la-grow">
          <p className="la-live-k">
            <span className="la-dot" aria-hidden="true" />
            {t.laInProgressSince(hhmm(props.since))}
          </p>
          <h2 id="la-lv" className="la-live-t">
            {props.name} <span>· {clock(props.elapsed)}</span>{' '}
            <em>{props.paused ? t.laPausedLower : t.laRunning}</em>
          </h2>
        </div>
      </div>
      <div className={`la-grid2 la-mt3${props.onFinish ? '' : ' one'}`}>
        <button type="button" className="la-ob og h44" onClick={props.onResume}>
          <Icon name="play" weight="fill" />
          {t.actResume}
        </button>
        {props.onFinish && (
          <button type="button" className="la-ob fg h44" onClick={props.onFinish}>
            <Icon name="stop" weight="fill" />
            {t.actFinish}
          </button>
        )}
      </div>
    </section>
  );
}

function HeroCard(props: {
  hero: LikelyNow | UpNext;
  web: boolean;
  t: Strings;
  locale: LocaleId;
  weekday: number;
  locked: boolean;
  onStart: () => void;
  onLog: () => void;
  onHide: () => void;
}) {
  const { hero, t, web } = props;
  const name = typeName(hero.type, t);
  const dur = fmtApprox(hero.medianMin, t);
  const tone = toneClass(hero.type);
  const likely = hero.kind === 'likely' ? hero : null;
  const up = hero.kind === 'upnext' ? hero : null;
  const kicker = likely
    ? t.laLikelyNow(props.weekday, t.laBand[likely.band])
    : t.laUpNext(typeName(up!.after, t));
  const title = likely ? `${name}?` : t.laUpNextQ(name, dur);
  const sub = likely
    ? likely.count >= likely.weeks
      ? t.laHeroSubAll(likely.count, props.weekday, dur)
      : t.laHeroSubSome(likely.count, likely.weeks, props.weekday, dur)
    : activityType(hero.type)?.category === 'recovery'
      ? t.laUpNextSubRec(typeName(up!.after, t), name)
      : t.laUpNextSub(typeName(up!.after, t), name);
  const foot = likely
    ? t.laHeroFoot(likely.weeks, props.weekday, minToHhmm(likely.usualStartMin))
    : t.laUpNextFoot(up!.count, up!.of, typeName(up!.after, t), name);
  const bars = likely?.recent ?? [];
  const maxMin = Math.max(1, ...bars.map((b) => b.minutes));
  const barsAria = t.laBarsAria(
    bars.map((b) => `${fmtDayMonth(b.day, props.locale)} ${fmtDur(b.minutes, t)}`).join(', '),
  );
  const barsEl = bars.length > 0 && (
    <div
      className={web ? 'la-wbars' : 'la-bars'}
      role="img"
      aria-label={barsAria}
      style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
    >
      {bars.map((b) =>
        web ? (
          <div key={b.day}>
            <div className="la-bv">{Math.round(b.minutes)}</div>
            <div className="la-bb">
              <span style={{ height: Math.max(4, Math.round((b.minutes / maxMin) * 28)) }} />
            </div>
            <div className="la-bl">{fmtDayMonth(b.day, props.locale)}</div>
          </div>
        ) : (
          <div key={b.day} className="la-bar">
            <div className="la-bar-box">
              <b style={{ height: Math.max(4, Math.round((b.minutes / maxMin) * 24)) }} />
            </div>
            <span>
              {fmtDayMonth(b.day, props.locale)} · {Math.round(b.minutes)}
            </span>
          </div>
        ),
      )}
    </div>
  );
  const buttons = (
    <>
      <button type="button" className="la-ob og" disabled={props.locked} onClick={props.onStart}>
        <Icon name="play" weight="fill" />
        {t.actStart}
      </button>
      <button
        type="button"
        className="la-ob fg"
        aria-label={t.laLogAria(name, dur)}
        onClick={props.onLog}
      >
        {t.laLogDur(dur)}
      </button>
    </>
  );
  return (
    <section className={`la-hero ${tone}${web ? ' web' : ''}`} aria-labelledby="la-hero-t">
      <div className="la-hero-k">
        <span className="la-tc">
          <Icon name={likely ? 'sparkle' : 'arrow-right'} />
          {kicker}
        </span>
        <button type="button" className="la-hide" aria-label={t.laHide} onClick={props.onHide}>
          <Icon name="x" />
        </button>
      </div>
      <div className="la-hero-main">
        <div className="la-ico n56">
          <Icon name={typeIcon(hero.type)} />
        </div>
        <div className="la-grow">
          <h2 id="la-hero-t" className={likely ? '' : 'up'}>
            {title}
          </h2>
          <p>{sub}</p>
        </div>
        {web && barsEl}
      </div>
      {!web && barsEl}
      {web ? (
        <div className="la-hero-actions">
          {buttons}
          <span>{foot}</span>
        </div>
      ) : (
        <>
          <div className="la-grid2 la-mt3">{buttons}</div>
          <p className="la-hero-foot">{foot}</p>
        </>
      )}
    </section>
  );
}

function FirstHero({ t }: { t: Strings }) {
  return (
    <section className="la-hero new" aria-labelledby="la-hero-t">
      <div className="la-hero-k">
        <span className="la-tc-g">
          <Icon name="sparkle" />
          {t.laNewHere}
        </span>
      </div>
      <h2 id="la-hero-t" className="la-first-t">
        {t.laFirstTitle}
      </h2>
      <p className="la-first-b">{t.laFirstBody}</p>
      <div className="la-row-g6 la-mt3">
        <span className="la-mini big la-g">
          <Icon name="person-simple-run" />
        </span>
        <span className="la-mini big la-s">
          <Icon name="tennis-ball" />
        </span>
        <span className="la-mini big la-r">
          <Icon name="fire" />
        </span>
      </div>
      <p className="la-hero-foot left">{t.laFirstFoot}</p>
    </section>
  );
}
