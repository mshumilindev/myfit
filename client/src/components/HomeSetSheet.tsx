/**
 * Home set sheet (design "Spotter — Home set", screens 02–06): opened from the
 * Start sheet's Home set tile.
 *
 *  • list     — your saved home sets on top. Tap one to start it; hold one to
 *               edit it (rename, reorder, add/remove moves, delete).
 *  • builder  — a new home set: a name + moves selected from Spotter's home
 *               moves or your own. Save keeps it (back to the list); Start runs
 *               it once without saving. With no saved sets yet, the sheet opens
 *               straight here.
 *  • move     — create or edit your own move (name, measure, muscle, icon);
 *               hold your own move to edit it, and delete it from there.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import './HomeSet.css';
import { deleteHomeMove, deleteHomeSet, saveHomeMove, saveHomeSet, useStore } from '../store';
import {
  HOME_CATALOG,
  HOME_ICONS,
  HOME_MUSCLES,
  homeMoveById,
  homeSetMoves,
  lastRunOf,
  ownMoveNameError,
  type HomeIcon,
  type HomeMeasure,
  type HomeMove,
  type HomeSet,
} from '../homeSets';
import type { MuscleGroup } from '../data/exercises';
import { fmtClock, fmtWeekdayShort, fmtDayMonth, useT } from '../i18n';
import { ConfirmDialog, Icon, Sheet, useExerciseName } from '../ui';
import { HomeMoveIcon } from './HomeMoveIcon';

type View =
  | { kind: 'list' }
  | { kind: 'builder' }
  | { kind: 'editSet'; id: string }
  | { kind: 'move'; id: string | null; back: View; into: 'builder' | 'editSet' | null }
  | { kind: 'addToSet'; back: View };

const HOLD_MS = 480;

/** Tap vs press-and-hold on one element (touch or mouse). */
function useHold(onHold: () => void, onTap: () => void) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      held.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        held.current = true;
        timer.current = null;
        if (navigator.vibrate) navigator.vibrate(12);
        onHold();
      }, HOLD_MS);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) clear();
    },
    onPointerUp: () => {
      const wasHeld = held.current;
      clear();
      if (!wasHeld) onTap();
    },
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}

export function HomeSetSheet(props: {
  onClose: () => void;
  /** Start a home set (saved or one-off). The caller opens the session. */
  onStart: (input: { set: HomeSet | null; name: string; moves: string[] }) => void;
}) {
  const store = useStore();
  const home = store.home;
  const [view, setView] = useState<View>(() =>
    home.sets.length > 0 ? { kind: 'list' } : { kind: 'builder' },
  );
  // Builder draft survives hops to "create your own".
  const [draft, setDraft] = useState<{ name: string; moves: string[] }>({ name: '', moves: [] });

  let body;
  if (view.kind === 'list') {
    body = (
      <ListView
        onStart={(set) => props.onStart({ set, name: set.name, moves: set.moves })}
        onEdit={(set) => setView({ kind: 'editSet', id: set.id })}
        onNew={() => {
          setDraft({ name: '', moves: [] });
          setView({ kind: 'builder' });
        }}
      />
    );
  } else if (view.kind === 'builder') {
    body = (
      <BuilderView
        draft={draft}
        onDraft={setDraft}
        canGoBack={home.sets.length > 0}
        onBack={() => (home.sets.length > 0 ? setView({ kind: 'list' }) : props.onClose())}
        onCreateMove={() => setView({ kind: 'move', id: null, back: view, into: 'builder' })}
        onEditMove={(m) => setView({ kind: 'move', id: m.id, back: view, into: null })}
        onSave={() => {
          saveHomeSet({ name: draft.name, moves: draft.moves });
          setDraft({ name: '', moves: [] });
          setView({ kind: 'list' });
        }}
        onStart={() => props.onStart({ set: null, name: draft.name.trim(), moves: draft.moves })}
      />
    );
  } else if (view.kind === 'editSet') {
    const set = home.sets.find((x) => x.id === view.id);
    body = set ? (
      <EditSetView
        key={set.id}
        set={set}
        onBack={() => setView({ kind: 'list' })}
        onAddMove={(back) => setView({ kind: 'addToSet', back })}
        onDeleted={() => setView(home.sets.length > 1 ? { kind: 'list' } : { kind: 'builder' })}
      />
    ) : null;
  } else if (view.kind === 'addToSet') {
    const back = view.back;
    const set = back.kind === 'editSet' ? home.sets.find((x) => x.id === back.id) : undefined;
    body = set ? (
      <AddToSetView
        set={set}
        onBack={() => setView(back)}
        onCreate={() => setView({ kind: 'move', id: null, back, into: 'editSet' })}
      />
    ) : null;
  } else {
    const v = view;
    body = (
      <MoveForm
        key={v.id ?? 'new'}
        move={v.id ? (homeMoveById(home, v.id) ?? null) : null}
        onBack={() => setView(v.back)}
        onSaved={(m) => {
          if (v.into === 'builder')
            setDraft((d) => ({
              ...d,
              moves: d.moves.includes(m.id) ? d.moves : [...d.moves, m.id],
            }));
          if (v.into === 'editSet' && v.back.kind === 'editSet') {
            const set = home.sets.find((x) => x.id === (v.back as { id: string }).id);
            if (set && !set.moves.includes(m.id))
              saveHomeSet({ id: set.id, name: set.name, moves: [...set.moves, m.id] });
          }
          setView(v.back);
        }}
        onDeleted={() => {
          setDraft((d) => ({ ...d, moves: d.moves.filter((x) => x !== v.id) }));
          setView(v.back);
        }}
      />
    );
  }

  return (
    <Sheet onClose={props.onClose} className="home-sheet">
      {body}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

function useLastLabel() {
  const { t, locale } = useT();
  return (at: number, min: number): string => {
    const d = new Date(at);
    const today = new Date();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    const when = same(d, today)
      ? `${t.homeToday}, ${fmtClock(at)}`
      : same(d, y)
        ? `${t.homeYesterday}, ${fmtClock(at)}`
        : `${fmtWeekdayShort(at, locale)} ${fmtDayMonth(at, locale)}`;
    return t.homeLastRun(when, min);
  };
}

function MoveChip({ move }: { move: HomeMove }) {
  const exName = useExerciseName();
  return (
    <span className="hs-chip">
      <HomeMoveIcon icon={move.icon} />
      {move.custom ? move.name : exName(move.name)}
    </span>
  );
}

function SetCard(props: { set: HomeSet; onStart: () => void; onEdit: () => void }) {
  const { t } = useT();
  const store = useStore();
  const lastLabel = useLastLabel();
  const moves = homeSetMoves(store.home, props.set);
  const last = lastRunOf(store.workouts, props.set.id);
  const [pressed, setPressed] = useState(false);
  const hold = useHold(props.onEdit, props.onStart);
  return (
    <div
      className={`hs-card${pressed ? ' pressed' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t.homeStartSet(props.set.name)}
      {...hold}
      onPointerDown={(e) => {
        setPressed(true);
        hold.onPointerDown(e);
      }}
      onPointerUp={() => {
        setPressed(false);
        hold.onPointerUp();
      }}
      onPointerLeave={() => {
        setPressed(false);
        hold.onPointerLeave();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') props.onStart();
      }}
    >
      <div className="hs-card-top">
        <span className="hs-card-text">
          <span className="hs-card-name">{props.set.name}</span>
          <span className="hs-card-last">
            {last ? lastLabel(last.at, last.durationMin) : t.homeNotDoneYet}
          </span>
        </span>
        <span className="hs-go" aria-hidden>
          <Icon name="play" weight="fill" />
        </span>
      </div>
      <div className="hs-chips">
        {moves.map((m) => (
          <MoveChip key={m.id} move={m} />
        ))}
      </div>
    </div>
  );
}

function ListView(props: {
  onStart: (set: HomeSet) => void;
  onEdit: (set: HomeSet) => void;
  onNew: () => void;
}) {
  const { t } = useT();
  const store = useStore();
  return (
    <div className="hs-view">
      <div className="hs-title">
        <Icon name="house" className="hs-title-ic" />
        {t.homeSetTitle}
      </div>
      <div className="section-label">{t.homeYourSets}</div>
      <div className="hs-list">
        {store.home.sets.map((s) => (
          <SetCard
            key={s.id}
            set={s}
            onStart={() => props.onStart(s)}
            onEdit={() => props.onEdit(s)}
          />
        ))}
      </div>
      <button type="button" className="btn btn-secondary hs-wide" onClick={props.onNew}>
        <Icon name="plus" />
        {t.homeNewSet}
      </button>
      <div className="hs-hint">
        <Icon name="info" />
        {t.homeListHint}
      </div>
    </div>
  );
}

function SelectTile(props: {
  move: HomeMove;
  on: boolean;
  onToggle: () => void;
  onHold?: () => void;
}) {
  const exName = useExerciseName();
  const hold = useHold(props.onHold ?? (() => undefined), props.onToggle);
  const handlers = props.onHold ? hold : { onClick: props.onToggle };
  return (
    <button
      type="button"
      className={`hs-tile${props.on ? ' on' : ''}`}
      aria-pressed={props.on}
      {...handlers}
    >
      {props.on && (
        <span className="hs-check" aria-hidden>
          <Icon name="check" weight="bold" />
        </span>
      )}
      <HomeMoveIcon icon={props.move.icon} className="hs-tile-ic" />
      <span className="hs-tile-name">
        {props.move.custom ? props.move.name : exName(props.move.name)}
      </span>
    </button>
  );
}

function BuilderView(props: {
  draft: { name: string; moves: string[] };
  onDraft: (d: { name: string; moves: string[] }) => void;
  canGoBack: boolean;
  onBack: () => void;
  onCreateMove: () => void;
  onEditMove: (m: HomeMove) => void;
  onSave: () => void;
  onStart: () => void;
}) {
  const { t } = useT();
  const store = useStore();
  const { draft } = props;
  const toggle = (id: string) =>
    props.onDraft({
      ...draft,
      moves: draft.moves.includes(id) ? draft.moves.filter((x) => x !== id) : [...draft.moves, id],
    });
  const selectedCount = draft.moves.length;
  const canSave = draft.name.trim().length > 0 && selectedCount > 0;
  return (
    <div className="hs-view">
      <div className="hs-head">
        {props.canGoBack && (
          <button
            type="button"
            className="hs-back"
            onClick={props.onBack}
            aria-label={t.backAction}
          >
            <Icon name="caret-left" />
          </button>
        )}
        <span className="hs-title">
          {!props.canGoBack && <Icon name="house" className="hs-title-ic" />}
          {t.homeNewSet}
        </span>
      </div>
      <p className="hs-cap">{t.homeBuilderCap}</p>
      <label className="field-block">
        <span className="field-label">{t.homeNameLabel}</span>
        <input
          className="input"
          value={draft.name}
          maxLength={40}
          placeholder={t.homeNamePlaceholder}
          onChange={(e) => props.onDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <div className="hs-row-sp">
        <span className="section-label">{t.homeSpotterMoves}</span>
        {selectedCount > 0 && <span className="hs-count">{t.homeSelected(selectedCount)}</span>}
      </div>
      <div className="hs-grid">
        {HOME_CATALOG.map((m) => (
          <SelectTile
            key={m.id}
            move={m}
            on={draft.moves.includes(m.id)}
            onToggle={() => toggle(m.id)}
          />
        ))}
      </div>
      <div className="section-label">{t.homeOwnMoves}</div>
      <div className="hs-grid">
        {store.home.moves.map((m) => (
          <SelectTile
            key={m.id}
            move={m}
            on={draft.moves.includes(m.id)}
            onToggle={() => toggle(m.id)}
            onHold={() => props.onEditMove(m)}
          />
        ))}
        <button type="button" className="hs-tile new" onClick={props.onCreateMove}>
          <Icon name="plus" className="hs-tile-ic" />
          <span className="hs-tile-name">{t.homeCreateOwn}</span>
        </button>
      </div>
      {store.home.moves.length > 0 && (
        <div className="hs-hint">
          <Icon name="info" />
          {t.homeOwnHint}
        </div>
      )}
      <div className="hs-actions">
        <button
          type="button"
          className="btn btn-secondary btn-big"
          disabled={!canSave}
          onClick={props.onSave}
        >
          <Icon name="check" />
          {t.homeSave}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-big hs-start"
          disabled={selectedCount === 0}
          onClick={props.onStart}
        >
          <Icon name="play" weight="fill" />
          {t.homeStart}
        </button>
      </div>
    </div>
  );
}

function EditSetView(props: {
  set: HomeSet;
  onBack: () => void;
  onAddMove: (back: View) => void;
  onDeleted: () => void;
}) {
  const { t } = useT();
  const store = useStore();
  const exName = useExerciseName();
  const [name, setName] = useState(props.set.name);
  const [confirm, setConfirm] = useState(false);
  const moves = homeSetMoves(store.home, props.set);
  const save = (patch: Partial<{ name: string; moves: string[] }>) =>
    saveHomeSet({
      id: props.set.id,
      name: patch.name ?? name,
      moves: patch.moves ?? props.set.moves,
    });
  const move = (i: number, d: number) => {
    const list = [...props.set.moves];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save({ moves: list });
  };
  return (
    <div className="hs-view">
      <div className="hs-head">
        <button type="button" className="hs-back" onClick={props.onBack} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="hs-title">{t.homeEditSet}</span>
        <button
          type="button"
          className="hs-link"
          disabled={!name.trim()}
          onClick={() => {
            save({ name: name.trim() });
            props.onBack();
          }}
        >
          {t.homeSave}
        </button>
      </div>
      <label className="field-block">
        <span className="field-label">{t.homeNameLabel}</span>
        <input
          className="input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="section-label">{t.homeMovesOrder}</div>
      <div className="hs-mlist">
        {moves.map((m, i) => (
          <div className="hs-mrow" key={m.id}>
            <span className="hs-mic">
              <HomeMoveIcon icon={m.icon} />
            </span>
            <span className="hs-mtext">
              <span className="hs-mname">{m.custom ? m.name : exName(m.name)}</span>
              <span className="hs-msub">{t.homeMeasureName[m.measure]}</span>
            </span>
            <button
              type="button"
              className="hs-mbtn"
              disabled={i === 0}
              aria-label={t.homeMoveUp}
              onClick={() => move(i, -1)}
            >
              <Icon name="caret-up" />
            </button>
            <button
              type="button"
              className="hs-mbtn"
              disabled={i === moves.length - 1}
              aria-label={t.homeMoveDown}
              onClick={() => move(i, 1)}
            >
              <Icon name="caret-down" />
            </button>
            <button
              type="button"
              className="hs-mbtn"
              aria-label={t.homeRemoveMove}
              disabled={moves.length === 1}
              onClick={() => save({ moves: props.set.moves.filter((x) => x !== m.id) })}
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-secondary hs-wide"
        onClick={() => props.onAddMove({ kind: 'editSet', id: props.set.id })}
      >
        <Icon name="plus" />
        {t.homeAddMove}
      </button>
      <div className="hs-spacer" />
      <button type="button" className="btn danger-outline hs-wide" onClick={() => setConfirm(true)}>
        <Icon name="trash" />
        {t.homeDeleteSet}
      </button>
      <div className="hs-foot">{t.homeDeleteSetNote(props.set.name)}</div>
      {confirm && (
        <ConfirmDialog
          title={t.homeDeleteSetTitle(props.set.name)}
          body={t.homeDeleteSetBody}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            deleteHomeSet(props.set.id);
            setConfirm(false);
            props.onDeleted();
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

function AddToSetView(props: { set: HomeSet; onBack: () => void; onCreate: () => void }) {
  const { t } = useT();
  const store = useStore();
  const exName = useExerciseName();
  const avail = (list: HomeMove[]) => list.filter((m) => !props.set.moves.includes(m.id));
  const add = (m: HomeMove) => {
    saveHomeSet({ id: props.set.id, name: props.set.name, moves: [...props.set.moves, m.id] });
    props.onBack();
  };
  const row = (m: HomeMove) => (
    <button type="button" className="hs-mrow tap" key={m.id} onClick={() => add(m)}>
      <span className="hs-mic">
        <HomeMoveIcon icon={m.icon} />
      </span>
      <span className="hs-mtext">
        <span className="hs-mname">{m.custom ? m.name : exName(m.name)}</span>
        <span className="hs-msub">{t.homeMeasureName[m.measure]}</span>
      </span>
      <span className="hs-add" aria-hidden>
        <Icon name="plus" />
      </span>
    </button>
  );
  const own = avail(store.home.moves);
  return (
    <div className="hs-view">
      <div className="hs-head">
        <button type="button" className="hs-back" onClick={props.onBack} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="hs-title">{t.homeAddMove}</span>
      </div>
      {own.length > 0 && (
        <>
          <div className="section-label">{t.homeOwnMoves}</div>
          <div className="hs-mlist">{own.map(row)}</div>
        </>
      )}
      <div className="section-label">{t.homeSpotterMoves}</div>
      <div className="hs-mlist">{avail(HOME_CATALOG).map(row)}</div>
      <button type="button" className="hs-create-row" onClick={props.onCreate}>
        <span className="hs-mic ghost">
          <Icon name="plus" />
        </span>
        {t.homeCreateOwnMove}
      </button>
    </div>
  );
}

/** Create / edit your own move. */
export function MoveForm(props: {
  move: HomeMove | null;
  onBack: () => void;
  onSaved: (m: HomeMove) => void;
  onDeleted?: () => void;
}) {
  const { t } = useT();
  const store = useStore();
  const m = props.move;
  const [name, setName] = useState(m?.name ?? '');
  const [measure, setMeasure] = useState<HomeMeasure>(m?.measure ?? 'reps');
  const [muscle, setMuscle] = useState<MuscleGroup>(m?.muscle ?? 'core');
  const [icon, setIcon] = useState<HomeIcon>(m?.icon ?? 'body');
  const [confirm, setConfirm] = useState(false);
  const err = ownMoveNameError(store.home, name, m?.id ?? null);
  const usedIn = m ? store.home.sets.filter((s) => s.moves.includes(m.id)) : [];
  return (
    <div className="hs-view">
      <div className="hs-head">
        <button type="button" className="hs-back" onClick={props.onBack} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="hs-title">{m ? t.homeEditMove : t.homeNewMove}</span>
      </div>
      <label className="field-block">
        <span className="field-label">{t.homeNameLabel}</span>
        <input
          className="input"
          value={name}
          maxLength={40}
          autoFocus={!m}
          placeholder={t.homeMovePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
        {err === 'taken' && <span className="hs-err">{t.homeNameTaken}</span>}
      </label>
      <div className="field-block">
        <span className="field-label">{t.homeMeasuredBy}</span>
        <div className="seg2 hs-seg">
          {(['reps', 'hold', 'time'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={measure === k ? 'active' : ''}
              onClick={() => setMeasure(k)}
            >
              {t.homeMeasureName[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="field-block">
        <span className="field-label">{t.homeMuscle}</span>
        <div className="hs-chips wrap">
          {HOME_MUSCLES.map((g) => (
            <button
              key={g}
              type="button"
              className={`hs-mchip${muscle === g ? ' on' : ''}`}
              onClick={() => setMuscle(g)}
            >
              {(t.muscleGroups as Record<string, string>)[g] ?? g}
            </button>
          ))}
        </div>
      </div>
      <div className="field-block">
        <span className="field-label">{t.homeIcon}</span>
        <div className="hs-icons">
          {HOME_ICONS.map((k) => (
            <button
              key={k}
              type="button"
              className={`hs-icbtn${icon === k ? ' on' : ''}`}
              aria-label={k}
              aria-pressed={icon === k}
              onClick={() => setIcon(k)}
            >
              <HomeMoveIcon icon={k} />
            </button>
          ))}
        </div>
      </div>
      <div className="hs-spacer" />
      <button
        type="button"
        className="btn btn-primary btn-big hs-wide"
        disabled={!!err}
        onClick={() => props.onSaved(saveHomeMove({ id: m?.id, name, measure, muscle, icon }))}
      >
        <Icon name="check" />
        {m ? t.homeSave : t.homeSaveMove}
      </button>
      {m && (
        <button
          type="button"
          className="btn danger-outline hs-wide"
          onClick={() => setConfirm(true)}
        >
          <Icon name="trash" />
          {t.homeDeleteMove}
        </button>
      )}
      {confirm && m && (
        <ConfirmDialog
          title={t.homeDeleteMoveTitle(m.name)}
          body={
            usedIn.length > 0
              ? t.homeDeleteMoveBodyIn(usedIn.map((s) => `“${s.name}”`).join(', '))
              : t.homeDeleteMoveBody
          }
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            deleteHomeMove(m.id);
            setConfirm(false);
            props.onDeleted?.();
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
