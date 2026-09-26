/**
 * Add / replace a move in a home set session (design "Home set" · Add move):
 * only home moves — your own and Spotter's home moves — never the gym base.
 * Tap a row to select it (background, not a border), then Add. Create your own
 * move right here; a move added to a session that came from a saved home set
 * also joins that set, so next time it's already there.
 */
import { useState } from 'react';
import './HomeSet.css';
import { saveHomeSet, useStore } from '../store';
import { HOME_CATALOG, type HomeMove } from '../homeSets';
import type { Workout } from '../types';
import { useT } from '../i18n';
import { Icon, Sheet, useExerciseName } from '../ui';
import { HomeMoveIcon } from './HomeMoveIcon';
import { MoveForm } from './HomeSetSheet';

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
        <MoveForm move={null} onBack={() => setCreating(false)} onSaved={commit} />
      </Sheet>
    );

  const row = (m: HomeMove) => {
    const on = picked?.id === m.id;
    return (
      <button
        type="button"
        key={m.id}
        className={`hs-mrow tap${on ? ' on' : ''}`}
        aria-pressed={on}
        onClick={() => setPicked(on ? null : m)}
      >
        <span className="hs-mic">
          <HomeMoveIcon icon={m.icon} />
        </span>
        <span className="hs-mtext">
          <span className="hs-mname">{m.custom ? m.name : exName(m.name)}</span>
          <span className="hs-msub">
            {(t.muscleGroups as Record<string, string>)[m.muscle] ?? m.muscle} ·{' '}
            {t.homeMeasureName[m.measure]}
          </span>
        </span>
        <span className="hs-add" aria-hidden>
          <Icon name={on ? 'check' : 'plus'} />
        </span>
      </button>
    );
  };

  return (
    <Sheet onClose={props.onClose} className="home-sheet home-pick">
      <div className="hs-view">
        <div className="hs-head">
          <span className="hs-title">{props.replacing ? t.replaceExercise : t.homeAddMove}</span>
          <span className="hs-badge">
            <Icon name="house" />
            {t.homeMovesOnly}
          </span>
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
        <button type="button" className="hs-create-row" onClick={() => setCreating(true)}>
          <span className="hs-mic ghost">
            <Icon name="plus" />
          </span>
          {t.homeCreateOwnMove}
        </button>
        <div className="hs-note">
          {set && !props.replacing ? t.homeGymStaysAlso(set.name) : t.homeGymStays}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-big hs-wide"
          disabled={!picked}
          onClick={() => picked && commit(picked)}
        >
          {picked
            ? t.homeAddNamed(picked.custom ? picked.name : exName(picked.name))
            : t.homeAddMove}
        </button>
      </div>
    </Sheet>
  );
}
