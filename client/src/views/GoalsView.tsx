/**
 * Goals ("My Fit") — the fourth peer tab of Programs/Playbook/Exercises.
 * Programs say WHAT you train; Goals say WHY: the physique you're building
 * toward, this block's per-muscle focus (grow/hold/ease), and long-term
 * measured goals (design GL-01). Focus is live; the physique picker (needs the
 * archetype silhouettes) and long-term goals land next.
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { ProgramsTabs, type ProgramsPeer } from '../components/ProgramsTabs';
import { FocusBodyMap } from '../components/Muscle';
import { FocusEditor } from './FocusEditor';
import { focusLists, groupEmphasis, FOCUS_MAV_DELTA } from '../goals';
import { focusToGroup, type FocusMuscle } from '../data/subregions';
import { LANDMARKS } from '../volume';
import { exercisesForSubRegions } from '../data/exercises';
import type { MuscleGroup } from '../data/exercises';
import type { Shell } from '../App';
import { Icon } from '../ui';

export function GoalsView({
  onProgramsTab,
}: {
  shell: Shell;
  onProgramsTab?: (peer: ProgramsPeer) => void;
}) {
  const { t } = useT();
  const store = useStore();
  const [editingFocus, setEditingFocus] = useState(false);

  const { grow, ease } = focusLists(store.goals);
  const hasFocus = grow.length > 0 || ease.length > 0;
  const label = (f: FocusMuscle) => t.subMuscleNames[f] ?? t.muscleGroups[focusToGroup(f)];

  // Weekly volume-target deltas the focus produces (coarse groups; generic base).
  const volDeltas = [...groupEmphasis(store.goals).entries()]
    .map(([m, e]) => {
      const base = LANDMARKS[m as MuscleGroup]?.mav;
      if (base == null) return null;
      const to = e === 'grow' ? base + FOCUS_MAV_DELTA : Math.max(0, base - FOCUS_MAV_DELTA);
      return { m: m as MuscleGroup, from: base, to, grow: e === 'grow' };
    })
    .filter((x): x is { m: MuscleGroup; from: number; to: number; grow: boolean } => !!x && x.from !== x.to);

  const suggestedMoves = exercisesForSubRegions(grow);

  return (
    <div className="screen programs-page programs-author-page programs-has-tabs goals-tab">
      <div className="programs-top">
        <div>
          <div className="kicker">{t.training}</div>
          <h2 className="title-26">{t.goalsTab}</h2>
        </div>
        <ProgramsTabs active="goals" onSelect={(peer) => onProgramsTab?.(peer)} />
      </div>

      <div className="goals-body">
        <p className="goals-intro">{t.goalsIntro}</p>

        {/* Physique target — awaits the archetype silhouettes */}
        <section className="goals-card">
          <div className="goals-card-head">
            <span className="goals-card-kicker">{t.goalsPhysiqueTitle}</span>
            <span className="tag tag-neutral goals-soon">{t.goalsSoon}</span>
          </div>
          <div className="goals-empty">
            <Icon name="user" />
            <p>{t.goalsPhysiqueEmpty}</p>
          </div>
        </section>

        {/* Focus this block — live */}
        <section className="goals-card">
          <div className="goals-card-head">
            <span className="goals-card-kicker">{t.goalsFocusTitle}</span>
            <button
              className="goals-edit"
              onClick={() => setEditingFocus(true)}
              aria-label={t.focusTitle}
            >
              <Icon name="pencil-simple" />
            </button>
          </div>
          {hasFocus ? (
            <div className="goals-focus">
              <FocusBodyMap grow={grow} ease={ease} view="both" width={104} className="goals-focus-map" />
              <div className="goals-focus-cols">
                {grow.length > 0 && (
                  <div>
                    <div className="goals-focus-lbl grow">{t.emphGrow}</div>
                    <div className="goals-chips">
                      {grow.map((f) => (
                        <span key={f} className="goals-chip grow">
                          {label(f)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {ease.length > 0 && (
                  <div>
                    <div className="goals-focus-lbl ease">{t.emphEase}</div>
                    <div className="goals-chips">
                      {ease.map((f) => (
                        <span key={f} className="goals-chip ease">
                          {label(f)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button className="goals-empty goals-empty-btn" onClick={() => setEditingFocus(true)}>
              <Icon name="crosshair" />
              <p>{t.goalsFocusEmpty}</p>
            </button>
          )}
        </section>

        {hasFocus && volDeltas.length > 0 && (
          <section className="goals-card">
            <div className="goals-card-head">
              <span className="goals-card-kicker">{t.goalsShapeTitle}</span>
            </div>
            <div className="goals-shape-lbl">{t.goalsVolumeTargets}</div>
            <div className="goals-vol">
              {volDeltas.map((d) => (
                <div className="goals-vol-row" key={d.m}>
                  <span className="goals-vol-name">{t.muscleGroups[d.m]}</span>
                  <span className="goals-vol-from">{d.from}</span>
                  <Icon name="arrow-right" />
                  <span className={`goals-vol-to ${d.grow ? 'grow' : 'ease'}`}>{d.to}</span>
                  <span className={`goals-vol-delta ${d.grow ? 'grow' : 'ease'}`}>
                    {d.grow ? `+${d.to - d.from}` : `−${d.from - d.to}`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasFocus && suggestedMoves.length > 0 && (
          <section className="goals-card">
            <div className="goals-card-head">
              <span className="goals-card-kicker">{t.goalsSuggestedTitle}</span>
            </div>
            <div className="goals-moves">
              {suggestedMoves.map((mv) => (
                <div className="goals-move" key={mv.name}>
                  <Icon name="chart-line-up" />
                  <span className="goals-move-name">{mv.name}</span>
                  <span className="goals-chip grow">{label(mv.region)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Long-term goals — next */}
        <section className="goals-card">
          <div className="goals-card-head">
            <span className="goals-card-kicker">{t.goalsLongTermTitle}</span>
            <span className="tag tag-neutral goals-soon">{t.goalsSoon}</span>
          </div>
          <div className="goals-empty">
            <Icon name="flag-banner" />
            <p>{t.goalsLongTermEmpty}</p>
          </div>
        </section>
      </div>

      {editingFocus && <FocusEditor onClose={() => setEditingFocus(false)} />}
    </div>
  );
}
