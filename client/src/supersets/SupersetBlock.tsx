/**
 * A superset as the session list draws it (Supersets chunk): the queued card, the collapsed "done" card, the desktop table and the
 * mobile strip with its member cards. Moved out of the session screen; the core renders it only through `supersetsHost.Block`.
 */
import { Fragment } from 'react';
import './SupersetBlock.css';
import { IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Tag } from '../components/ui/Tag';
import { fmtWeightValue } from '../fmtWeight';
import { equipmentIconName } from '../components/Muscle';
import { fmtKg, useT } from '../i18n';
import {
  equipmentFor,
  exerciseVolumeKg,
  groupCurrentRound,
  groupRounds,
  liftVariant,
  prevLift,
  resolveMuscles,
} from '../store';
import type { SupersetBlockProps } from '../supersetsApi';
import { Icon, useExerciseName } from '../ui';

export function SupersetBlock(p: SupersetBlockProps) {
  const { t } = useT();
  const exName = useExerciseName();
  const g = p.group;
  const rounds = groupRounds(g);
  const round = groupCurrentRound(g);
  const equipmentLabelOf = (id: string): string => {
    const names = t.equipmentNames as Record<string, string>;
    return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
  };

  if (p.queued) {
    return (
      <Fragment>
        {p.header}
        <Card
          as="button"
          pad="none"
          className="past-ex-card queued-ex-card queued-group"
          onClick={() => p.onExpand(g.exercises[0]?.id ?? null)}
        >
          <span className="n">{g.exercises.map((e) => e.name).join(' · ')}</span>
          <span className="count">{t.supersetTag(g.letter)}</span>
        </Card>
      </Fragment>
    );
  }

  const minSets = Math.min(...g.exercises.map((e) => e.sets.length));
  const activeMemberId = g.exercises.find((e) => e.sets.length === minSets)?.id ?? null;
  const groupActive = g.exercises.some((e) => e.id === p.focusedId);
  const groupIsCurrent = g.exercises.some((e) => e.id === p.activeExerciseId);
  const collapsed = p.past
    ? g.exercises.some((e) => e.sets.length > 0) &&
      !g.exercises.some((e) => p.expandedPast.includes(e.id))
    : p.live && !groupActive && (g.exercises.some((e) => e.sets.length > 0) || groupIsCurrent);

  if (collapsed) {
    const kg = g.exercises.reduce((v, e) => v + exerciseVolumeKg(e), 0);
    return (
      <div className={`ss-block past${groupIsCurrent && !p.past ? ' is-current' : ''}`}>
        <div className="ss-bar" />
        <div className="ss-body">
          <div className="ss-head">
            <Tag tone="neutral">{t.supersetTag(g.letter)}</Tag>
            {groupIsCurrent && !p.past && (
              <Tag tone="accent" icon={<Icon name="barbell" />}>
                {t.currentKicker}
              </Tag>
            )}
            <span className="ss-rounds-meta">{t.roundsMeta(rounds, fmtKg(kg))}</span>
          </div>
          <Card
            as="button"
            pad="none"
            className="past-ex-card"
            onClick={() =>
              p.past
                ? p.onExpandPast(g.exercises.map((e) => e.id))
                : p.onExpand(g.exercises[0]?.id ?? null)
            }
          >
            {g.exercises.map((e, i) => (
              <span key={e.id} className="past-ex-row">
                <span className="ss-index">
                  {g.letter}
                  {i + 1}
                </span>
                <span className="n">{exName(e.name)}</span>
                <span className="v">{p.summary(e)}</span>
              </span>
            ))}
          </Card>
        </div>
      </div>
    );
  }

  if (p.desktop && p.live) {
    // DS-4 · desktop: the group is one table — bracket outside, Muscles (and Equipment) columns added to grouped tables only.
    return (
      <div className="ss-block ss-desktop">
        <div className="ss-bar" />
        <div className="ss-desktop-card">
          <div className="ss-head">
            <Tag tone="accent">{t.supersetTag(g.letter)}</Tag>
            <span className="ss-round">{t.roundOf(round, rounds).split(' · ')[0]}</span>
            <IconButton
              icon="dots-three"
              size="sm"
              className="dots"
              onClick={() => p.onMenu(g.groupId)}
              label={t.menuAction}
            />
          </div>
          <table className="table ss-table">
            <thead>
              <tr>
                <th className="ss-col-idx"></th>
                <th>{t.exerciseLabel}</th>
                <th className="ss-col-muscles">{t.musclesCol}</th>
                {p.equipmentOn && <th className="ss-col-equip">{t.progEquipment}</th>}
                <th className="ss-col-round">{t.roundCol}</th>
                <th className="ss-col-last">{t.lastCol}</th>
              </tr>
            </thead>
            <tbody>
              {g.exercises.map((e, i) => {
                const m = resolveMuscles(e);
                const eq = equipmentFor(e);
                const prevL = prevLift(e.name, p.workout.id, liftVariant(p.workout, e));
                return (
                  <tr key={e.id}>
                    <td className="ss-td-idx">
                      {g.letter}
                      {i + 1}
                    </td>
                    <td>{exName(e.name)}</td>
                    <td>
                      <span className="ul-iflex ug-6">
                        {m.primary && <span className="mchip">{t.muscleGroups[m.primary]}</span>}
                        {m.secondary.map((x) => (
                          <span key={x} className="mchip">
                            {t.muscleGroups[x]}
                          </span>
                        ))}
                      </span>
                    </td>
                    {p.equipmentOn && (
                      <td>
                        {eq.map((id) => (
                          <span key={id} className="eq">
                            <Icon name={equipmentIconName(id)} /> {equipmentLabelOf(id)}
                          </span>
                        ))}
                      </td>
                    )}
                    <td className="num">
                      {e.sets.length} / {rounds}
                    </td>
                    <td className="num dim">
                      {prevL
                        ? `${prevL.reps} × ${prevL.weight === null ? '—' : fmtWeightValue(prevL.weight)}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={`ss-block${p.past ? ' past' : ''}`}>
      <div className="ss-bar" />
      <div className="ss-body">
        <div className="ss-head">
          <Tag tone="accent">{t.supersetTag(g.letter)}</Tag>
          <span className="ss-round">{t.roundOf(round, rounds)}</span>
          <IconButton
            icon="dots-three-vertical"
            size="sm"
            className="dots"
            onClick={() => p.onMenu(g.groupId)}
            label={t.menuAction}
          />
        </div>
        {g.exercises.map((e, i) =>
          p.renderCard(e, {
            letter: g.letter,
            index: i,
            active: activeMemberId === e.id,
            rounds,
            round,
          }),
        )}
      </div>
    </div>
  );
}
