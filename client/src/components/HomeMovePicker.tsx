/**
 * Add / replace a move in a home set session (design "Home set" · Add move):
 * only home moves — your own and Spotter's home moves — never the gym base.
 * Tap a row to select it (background, not a border), then Add. Create your own
 * move right here; a move added to a session that came from a saved home set
 * also joins that set, so next time it's already there.
 */
import { useState } from 'react';
import { Button } from './ui/Button';
import { ListRow } from './ui/GroupedList';
import { IconTile } from './ui/IconTile';
import './HomeSet.css';
import { saveHomeSet, useStore } from '../store';
import { HOME_CATALOG, type HomeMove } from '../homeSets';
import type { Workout } from '../types';
import { useT } from '../i18n';
import { Icon, Sheet, useExerciseName } from '../ui';
import { HomeMoveIcon } from './HomeMoveIcon';
import { BackButton } from './ui/BackButton';
import { useOwnMoveForm } from './HomeMoveForm';
import { Tag } from './ui/Tag';

export function HomeMovePicker(props: {
  workout: Workout;
  replacing?: boolean;
  onPick: (move: HomeMove) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const store = useStore();
  const exName = useExerciseName();
  const [picked, setPicked] = useState<HomeMove | null>(null);
  const [creating, setCreating] = useState(false);
  const inSession = new Set(props.workout.exercises.map((e) => e.name.toLowerCase()));
  const avail = (list: HomeMove[]) => list.filter((m) => !inSession.has(m.name.toLowerCase()));
  const own = avail(store.home.moves);
  const catalog = avail(HOME_CATALOG);
  const set = props.workout.homeSetId
    ? store.home.sets.find((x) => x.id === props.workout.homeSetId)
    : undefined;

  const commit = (m: HomeMove) => {
    if (set && !props.replacing && !set.moves.includes(m.id))
      saveHomeSet({ id: set.id, name: set.name, moves: [...set.moves, m.id] });
    props.onPick(m);
  };

  if (creating)
    return (
      <Sheet onClose={props.onClose} className="home-sheet">
        <CreateMove onBack={() => setCreating(false)} onSaved={commit} />
      </Sheet>
    );

  const row = (m: HomeMove) => {
    const on = picked?.id === m.id;
    return (
      <ListRow
        key={m.id}
        dense
        strong
        selected={on}
        aria-pressed={on}
        icon={
          <IconTile size={40}>
            <HomeMoveIcon icon={m.icon} />
          </IconTile>
        }
        label={m.custom ? m.name : exName(m.name)}
        sub={`${(t.muscleGroups as Record<string, string>)[m.muscle] ?? m.muscle} · ${t.homeMeasureName[m.measure]}`}
        trailing={<Icon name={on ? 'check' : 'plus'} />}
        onClick={() => setPicked(on ? null : m)}
      />
    );
  };

  return (
    <Sheet onClose={props.onClose} className="home-sheet home-pick">
      <div className="hs-view">
        <div className="hs-head">
          <span className="hs-title">{props.replacing ? t.replaceExercise : t.homeAddMove}</span>
          <Tag tone="home" icon={<Icon name="house" />}>
            {t.homeMovesOnly}
          </Tag>
        </div>
        {own.length > 0 && (
          <>
            <div className="section-label">{t.homeOwnMoves}</div>
            <div className="hs-mlist">{own.map(row)}</div>
          </>
        )}
        {catalog.length > 0 && (
          <>
            <div className="section-label">{t.homeSpotterMoves}</div>
            <div className="hs-mlist">{catalog.map(row)}</div>
          </>
        )}
        <ListRow
          dense
          strong
          icon={<IconTile outline size={40} icon="plus" />}
          label={t.homeCreateOwnMove}
          onClick={() => setCreating(true)}
        />
        <div className="hs-note">
          {set && !props.replacing ? t.homeGymStaysAlso(set.name) : t.homeGymStays}
        </div>
        <Button
          variant="primary"
          size="lg"
          className="hs-wide"
          disabled={!picked}
          onClick={() => picked && commit(picked)}
        >
          {picked
            ? t.homeAddNamed(picked.custom ? picked.name : exName(picked.name))
            : t.homeAddMove}
        </Button>
      </div>
    </Sheet>
  );
}

/** Create your own move from the picker — the same form as the Home set screen's. */
function CreateMove(props: { onBack: () => void; onSaved: (m: HomeMove) => void }) {
  const { t } = useT();
  const form = useOwnMoveForm(null, { onSaved: props.onSaved });
  return (
    <div className="hs-view">
      <div className="hs-head">
        <BackButton className="hs-back" label={t.backAction} onClick={props.onBack} />
        <span className="hs-title">{t.homeNewMove}</span>
      </div>
      {form.fields}
      <Button
        variant="primary"
        size="lg"
        icon="check"
        className="hs-wide"
        disabled={!form.canSave}
        onClick={form.save}
      >
        {t.homeSaveMove}
      </Button>
    </div>
  );
}
