/**
 * Home set — a full screen (replaces the old bottom sheet). One page with two tabs,
 * Sets | My moves, and three pushed pages that each follow the app's overlay stack, so
 * Back and the edge swipe go one step up:
 *
 *  • home  — Sets: your saved home sets (tap = open the set page, play = start it).
 *            My moves: filter by muscle, your own moves (tap = edit / delete) and
 *            Spotter's home moves (tap = read-only view).
 *  • set   — ONE page for a new and for a saved set: name + its moves + Choose/Add
 *            moves. New: Save keeps it, Start runs it once. Saved: Cancel + Save (only
 *            when something changed) and Delete. Edits are a draft until Save.
 *  • add   — the moves picker: muscle chips, check rows, Create your own move.
 *  • move  — the own-move form (or the read-only page of a Spotter move).
 *
 * Drafts live in homeSetDraft.ts so they survive the hops. Kit components only.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Shell } from '../../App';
import { BackButton } from '../../components/ui/BackButton';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field } from '../../components/ui/Field';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { PresetChips } from '../../components/ui/PresetChips';
import { Segmented } from '../../components/ui/Segmented';
import { StickyActionBar } from '../../components/ui/StickyActionBar';
import { Tag } from '../../components/ui/Tag';
import { HomeMoveIcon } from '../../components/HomeMoveIcon';
import { useOwnMoveForm } from '../../components/HomeMoveForm';
import { ConfirmDialog } from '../../ui';
import { deleteHomeSet, saveHomeSet, startHomeSet, useStore } from '../../store';
import {
  HOME_CATALOG,
  HOME_MUSCLES,
  allHomeMoves,
  homeMoveById,
  lastRunOf,
  type HomeMove,
} from '../../homeSets';
import type { MuscleGroup } from '../../data/exercises';
import { useT } from '../../i18n';
import {
  NEW_SET,
  dropSetDraft,
  forgetMove,
  putSetDraft,
  setPicks,
  usePicks,
  useSetDraft,
  type SetDraft,
} from './homeSetDraft';
import { useLastLabel, useLiveLock, useMoveName, useMuscleName } from './homeHooks';
import '../Health.css';

export type HomeTab = 'sets' | 'moves';

/** Where the screen is: the home page (+ tab) or one of its pushed pages. */
export interface HomeSetRoute {
  page?: 'set' | 'add' | 'move';
  /** set / add: the saved set's id (none = a new set). move: the move's id (none = new). */
  id?: string;
  tab?: HomeTab;
  /** A move created from the picker joins the picker's selection. */
  pick?: boolean;
}

const HOME = { screen: 'home-set' } as const;

interface Props extends HomeSetRoute {
  shell: Shell;
  /** One step back (the app's overlay Back). */
  onClose: () => void;
}

export function HomeSetView(props: Props) {
  if (props.page === 'set') return <SetPage {...props} />;
  if (props.page === 'add') return <AddPage {...props} />;
  if (props.page === 'move') return <MovePage {...props} />;
  return <HomePage {...props} />;
}

/** The page chrome shared by every page of the screen. */
function Page(props: {
  title: string;
  onBack: () => void;
  children: ReactNode;
  bar?: ReactNode;
  barNote?: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={props.onBack} />
        <h1 className="hl-pt">{props.title}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">{props.children}</div>
      </div>
      {props.bar && (
        <StickyActionBar variant="page" surface="bg" note={props.barNote}>
          {props.bar}
        </StickyActionBar>
      )}
    </div>
  );
}

/** A page whose subject is gone (deleted, stale link): fall back to the home page. */
function Gone({ shell }: { shell: Shell }) {
  const { replaceOverlay } = shell;
  useEffect(() => replaceOverlay(HOME), [replaceOverlay]);
  return null;
}

/** "The one thing live" notice: nothing can start until it is finished. */
function LiveNotice() {
  const { t } = useT();
  const { locked, liveName } = useLiveLock();
  return locked ? <Notice tone="neutral">{t.startFinishFirst(liveName)}</Notice> : null;
}

/** Start a home set once, then leave the screen for the session (Back lands on Today). */
function useStartSet(shell: Shell) {
  return (input: Parameters<typeof startHomeSet>[0]) => {
    const w = startHomeSet(input);
    if (!w) return;
    shell.openOverlay(null);
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  };
}

function MuscleFilter(props: {
  moves: HomeMove[];
  value: MuscleGroup | null;
  onChange: (g: MuscleGroup | null) => void;
}) {
  const { t } = useT();
  const muscleName = useMuscleName();
  const muscles = HOME_MUSCLES.filter((g) => props.moves.some((m) => m.muscle === g));
  return (
    <PresetChips
      layout="scroll"
      label={t.homeMuscle}
      items={[
        {
          id: 'all',
          label: t.homeMuscleAll,
          selected: !props.value,
          onClick: () => props.onChange(null),
        },
        ...muscles.map((g) => ({
          id: g,
          label: muscleName(g),
          selected: props.value === g,
          onClick: () => props.onChange(props.value === g ? null : g),
        })),
      ]}
    />
  );
}

function MoveRow(props: {
  move: HomeMove;
  sub: ReactNode;
  tile?: 'home' | 'neutral';
  check?: boolean;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick: () => void;
}) {
  const moveName = useMoveName();
  return (
    <ListRow
      dense
      strong
      icon={
        <IconTile tone={props.tile ?? 'neutral'} size={40}>
          <HomeMoveIcon icon={props.move.icon} />
        </IconTile>
      }
      label={moveName(props.move)}
      sub={props.sub}
      trailing={props.trailing}
      check={props.check}
      chevron={props.chevron}
      onClick={props.onClick}
    />
  );
}

// --- Home: Sets | My moves ---------------------------------------------------

function HomePage({ shell, tab = 'sets', onClose }: Props) {
  const { t } = useT();
  const { home } = useStore();
  const sets = tab === 'sets';
  return (
    <Page
      title={t.homeSetTitle}
      onBack={onClose}
      bar={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon="plus"
          onClick={() =>
            sets
              ? (dropSetDraft(NEW_SET), shell.openOverlay({ ...HOME, page: 'set' }))
              : shell.openOverlay({ ...HOME, page: 'move' })
          }
        >
          {sets ? t.homeNewSet : t.homeNewMove}
        </Button>
      }
    >
      <Segmented
        tabs
        label={t.homeSetTitle}
        value={tab}
        onChange={(next) => shell.replaceOverlay({ ...HOME, tab: next })}
        options={[
          { value: 'sets', label: t.homeTabSets, icon: 'house' },
          { value: 'moves', label: t.homeTabMoves, icon: 'barbell' },
        ]}
      />
      {sets ? (
        home.sets.length === 0 ? (
          <EmptyState centered icon="house" title={t.homeEmptyTitle} body={t.homeEmptyBody} />
        ) : (
          <SetsList shell={shell} />
        )
      ) : (
        <MyMoves shell={shell} />
      )}
    </Page>
  );
}

function SetsList({ shell }: { shell: Shell }) {
  const { t } = useT();
  const { home, workouts } = useStore();
  const lastLabel = useLastLabel();
  const { locked } = useLiveLock();
  const start = useStartSet(shell);
  return (
    <>
      <LiveNotice />
      <GroupedList label={t.homeYourSets} footer={t.homeSetsFooter}>
        {home.sets.map((s) => {
          const last = lastRunOf(workouts, s.id);
          return (
            <ListRow
              key={s.id}
              strong
              icon={<IconTile tone="home" size={40} icon="house" />}
              label={s.name}
              sub={`${t.homeMovesCount(s.moves.length)} · ${
                last ? lastLabel(last.at, last.durationMin) : t.homeNotDoneYet
              }`}
              trailing={
                <>
                  <IconButton
                    size="sm"
                    icon="caret-right"
                    label={t.homeOpenSet(s.name)}
                    onClick={() => shell.openOverlay({ ...HOME, page: 'set', id: s.id })}
                  />
                  <IconButton
                    variant="primary"
                    size="sm"
                    shape="round"
                    icon="play"
                    label={t.homeStartSet(s.name)}
                    disabled={locked}
                    onClick={() => start({ set: s, name: s.name, moves: s.moves })}
                  />
                </>
              }
            />
          );
        })}
      </GroupedList>
    </>
  );
}

/** The one place that lists moves: your own and Spotter's home moves. */
function MyMoves({ shell }: { shell: Shell }) {
  const { t } = useT();
  const { home } = useStore();
  const muscleName = useMuscleName();
  const [filter, setFilter] = useState<MuscleGroup | null>(null);
  const keep = (m: HomeMove) => !filter || m.muscle === filter;
  const row = (m: HomeMove) => (
    <MoveRow
      key={m.id}
      move={m}
      tile={m.custom ? 'home' : 'neutral'}
      sub={muscleName(m.muscle)}
      trailing={<Tag tone="neutral">{t.homeMeasureName[m.measure]}</Tag>}
      chevron
      onClick={() => shell.openOverlay({ ...HOME, page: 'move', id: m.id })}
    />
  );
  const own = home.moves.filter(keep);
  const spotter = HOME_CATALOG.filter(keep);
  return (
    <>
      <MuscleFilter moves={allHomeMoves(home)} value={filter} onChange={setFilter} />
      {own.length > 0 && (
        <GroupedList header={t.homeOwnMoves} footer={t.homeOwnMovesFooter}>
          {own.map(row)}
        </GroupedList>
      )}
      {spotter.length > 0 && (
        <GroupedList header={t.homeSpotterMoves}>{spotter.map(row)}</GroupedList>
      )}
    </>
  );
}

// --- A set: new or saved -------------------------------------------------------

function SetPage({ shell, id, onClose }: Props) {
  const { t } = useT();
  const { home } = useStore();
  const moveName = useMoveName();
  const { locked } = useLiveLock();
  const start = useStartSet(shell);
  const key = id ?? NEW_SET;
  const saved = id ? (home.sets.find((s) => s.id === id) ?? null) : null;
  const stored = useSetDraft(key);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState<HomeMove | null>(null);
  if (id && !saved) return <Gone shell={shell} />;

  const cur: SetDraft = stored ?? {
    name: saved?.name ?? '',
    moves: saved?.moves ?? [],
  };
  const moves = cur.moves.map((mid) => homeMoveById(home, mid)).filter((m): m is HomeMove => !!m);
  const ids = moves.map((m) => m.id);
  const name = cur.name.trim();
  const edit = (patch: Partial<SetDraft>) => putSetDraft(key, { ...cur, moves: ids, ...patch });
  const dirty = saved ? name !== saved.name || ids.join() !== saved.moves.join() : true;
  const valid = name.length > 0 && ids.length > 0;
  const shift = (i: number, d: number) => {
    const list = [...ids];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    edit({ moves: list });
  };
  const leave = () => {
    dropSetDraft(key);
    onClose();
  };
  const save = () => {
    saveHomeSet({ id: saved?.id, name, moves: ids });
    leave();
  };

  return (
    <Page
      title={saved ? t.homeEditSet : t.homeNewSet}
      onBack={onClose}
      barNote={saved ? undefined : t.homeSaveStartNote}
      bar={
        saved ? (
          <>
            <Button variant="secondary" size="lg" onClick={leave}>
              {t.cancel}
            </Button>
            <Button
              variant="primary"
              size="lg"
              icon="check"
              disabled={!valid || !dirty}
              onClick={save}
            >
              {t.homeSave}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="lg" icon="check" disabled={!valid} onClick={save}>
              {t.homeSave}
            </Button>
            <Button
              variant="primary"
              size="lg"
              icon="play"
              disabled={ids.length === 0 || locked}
              onClick={() => start({ set: null, name: name || t.homeSetTitle, moves: ids })}
            >
              {t.homeStart}
            </Button>
          </>
        )
      }
    >
      {!saved && <LiveNotice />}
      <Field
        label={t.homeNameLabel}
        value={cur.name}
        maxLength={40}
        placeholder={t.homeNamePlaceholder}
        onChange={(e) => edit({ name: e.target.value })}
      />
      <GroupedList
        header={ids.length > 0 ? `${t.homeMovesOrder} · ${ids.length}` : t.homeMovesOrder}
        footer={ids.length === 0 ? t.homeNeedMove : undefined}
      >
        {moves.map((m, i) => (
          <ListRow
            key={m.id}
            dense
            icon={
              <IconTile tone="home" size={36}>
                <HomeMoveIcon icon={m.icon} />
              </IconTile>
            }
            label={moveName(m)}
            sub={t.homeMeasureName[m.measure]}
            trailing={
              <>
                <IconButton
                  size="sm"
                  icon="caret-up"
                  label={t.homeMoveUp}
                  disabled={i === 0}
                  onClick={() => shift(i, -1)}
                />
                <IconButton
                  size="sm"
                  icon="caret-down"
                  label={t.homeMoveDown}
                  disabled={i === moves.length - 1}
                  onClick={() => shift(i, 1)}
                />
                <IconButton
                  size="sm"
                  icon="x"
                  label={t.homeRemoveMove}
                  onClick={() => setRemoving(m)}
                />
              </>
            }
          />
        ))}
        <ListRow
          dense
          strong
          icon={<IconTile outline size={36} icon="plus" />}
          label={ids.length > 0 ? t.homeAddMove : t.homeChooseMoves}
          chevron
          onClick={() => {
            // Make sure the draft exists, so the picker adds onto it.
            putSetDraft(key, { ...cur, moves: ids });
            shell.openOverlay({ ...HOME, page: 'add', id });
          }}
        />
      </GroupedList>
      {saved && (
        <GroupedList footer={t.homeDeleteSetNote(saved.name)}>
          <ListRow action tone="danger" label={t.homeDeleteSet} onClick={() => setConfirm(true)} />
        </GroupedList>
      )}
      {removing && (
        <ConfirmDialog
          title={t.homeRemoveMoveTitle(moveName(removing))}
          body={t.homeRemoveMoveBody}
          confirmLabel={t.homeRemoveMoveConfirm}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            edit({ moves: ids.filter((x) => x !== removing.id) });
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
      {confirm && saved && (
        <ConfirmDialog
          title={t.homeDeleteSetTitle(saved.name)}
          body={t.homeDeleteSetBody}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            deleteHomeSet(saved.id);
            setConfirm(false);
            leave();
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Page>
  );
}

// --- The moves picker ----------------------------------------------------------

function AddPage({ shell, id, onClose }: Props) {
  const { t } = useT();
  const { home } = useStore();
  const muscleName = useMuscleName();
  const key = id ?? NEW_SET;
  const saved = id ? (home.sets.find((s) => s.id === id) ?? null) : null;
  const stored = useSetDraft(key);
  const pick = usePicks();
  const [filter, setFilter] = useState<MuscleGroup | null>(null);
  if (id && !saved) return <Gone shell={shell} />;

  const cur: SetDraft = stored ?? { name: saved?.name ?? '', moves: saved?.moves ?? [] };
  const free = allHomeMoves(home).filter((m) => !cur.moves.includes(m.id));
  const shown = free.filter((m) => !filter || m.muscle === filter);
  const toggle = (mid: string) =>
    setPicks(pick.includes(mid) ? pick.filter((x) => x !== mid) : [...pick, mid]);
  const row = (m: HomeMove) => (
    <MoveRow
      key={m.id}
      move={m}
      tile={pick.includes(m.id) ? 'home' : 'neutral'}
      sub={`${t.homeMeasureName[m.measure]} · ${muscleName(m.muscle)}`}
      check={pick.includes(m.id)}
      onClick={() => toggle(m.id)}
    />
  );
  const own = shown.filter((m) => m.custom);
  const spotter = shown.filter((m) => !m.custom);
  const into = saved?.name ?? (cur.name.trim() || t.homeNewSet);
  const add = () => {
    const chosen = pick.filter((x) => !cur.moves.includes(x) && homeMoveById(home, x));
    putSetDraft(key, { ...cur, moves: [...cur.moves, ...chosen] });
    setPicks([]);
    onClose();
  };
  return (
    <Page
      title={t.homeAddMove}
      onBack={onClose}
      bar={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon="plus"
          disabled={pick.length === 0}
          onClick={add}
        >
          {pick.length > 0 ? t.homeAddCountTo(pick.length, into) : t.homeAddMove}
        </Button>
      }
    >
      <MuscleFilter moves={free} value={filter} onChange={setFilter} />
      {own.length > 0 && <GroupedList header={t.homeOwnMoves}>{own.map(row)}</GroupedList>}
      {spotter.length > 0 && (
        <GroupedList header={t.homeSpotterMoves}>{spotter.map(row)}</GroupedList>
      )}
      <GroupedList>
        <ListRow
          dense
          strong
          icon={<IconTile outline size={40} icon="plus" />}
          label={t.homeCreateOwnMove}
          onClick={() => shell.openOverlay({ ...HOME, page: 'move', pick: true })}
        />
      </GroupedList>
    </Page>
  );
}

// --- Create / edit your own move, or look at a Spotter one ---------------------

function MovePage(props: Props) {
  const { home } = useStore();
  const move = props.id ? homeMoveById(home, props.id) : null;
  if (props.id && !move) return <Gone shell={props.shell} />;
  if (move && !move.custom) return <SpotterMove move={move} onClose={props.onClose} />;
  return <OwnMove key={move?.id ?? NEW_SET} {...props} move={move} />;
}

function OwnMove({ move, pick, onClose }: Props & { move: HomeMove | null }) {
  const { t } = useT();
  const picks = usePicks();
  const form = useOwnMoveForm(move, {
    onSaved: (m) => {
      if (pick && !picks.includes(m.id)) setPicks([...picks, m.id]);
      onClose();
    },
    onDeleted: (mid) => {
      forgetMove(mid);
      onClose();
    },
  });
  return (
    <Page
      title={move ? t.homeEditMove : t.homeNewMove}
      onBack={onClose}
      bar={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon="check"
          disabled={!form.canSave}
          onClick={form.save}
        >
          {move ? t.homeSave : t.homeSaveMove}
        </Button>
      }
    >
      {form.fields}
    </Page>
  );
}

function SpotterMove({ move, onClose }: { move: HomeMove; onClose: () => void }) {
  const { t } = useT();
  const { home } = useStore();
  const moveName = useMoveName();
  const muscleName = useMuscleName();
  const usedIn = home.sets.filter((s) => s.moves.includes(move.id));
  return (
    <Page title={moveName(move)} onBack={onClose}>
      <GroupedList header={t.homeAboutMove}>
        <ListRow
          icon={
            <IconTile size={40}>
              <HomeMoveIcon icon={move.icon} />
            </IconTile>
          }
          label={moveName(move)}
          sub={t.homeSpotterMove}
        />
        <ListRow label={t.homeMeasuredBy} value={t.homeMeasureName[move.measure]} />
        <ListRow label={t.homeMuscle} value={muscleName(move.muscle)} />
        <ListRow
          label={t.homeInYourSets}
          value={usedIn.length ? usedIn.map((s) => s.name).join(', ') : t.homeNoneYet}
        />
      </GroupedList>
      <Notice tone="neutral">{t.homeSpotterLocked}</Notice>
    </Page>
  );
}
