/**
 * Goals ("My Fit") — the fourth peer tab of Programs/Playbook/Exercises.
 * Programs say WHAT you train; Goals say WHY: the physique you're building
 * toward, this block's per-muscle focus (grow/hold/ease), and long-term
 * measured goals. This is the overview (design GL-01). The physique picker,
 * focus editor and long-term detail land as follow-up screens; for now each
 * section shows its empty state so the tab is coherent and navigable.
 */
import { useT } from '../i18n';
import { ProgramsTabs, type ProgramsPeer } from '../components/ProgramsTabs';
import type { Shell } from '../App';
import { Icon } from '../ui';

export function GoalsView({
  onProgramsTab,
}: {
  shell: Shell;
  onProgramsTab?: (peer: ProgramsPeer) => void;
}) {
  const { t } = useT();

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

        <section className="goals-card">
          <div className="goals-card-head">
            <span className="goals-card-kicker">{t.goalsFocusTitle}</span>
            <span className="tag tag-neutral goals-soon">{t.goalsSoon}</span>
          </div>
          <div className="goals-empty">
            <Icon name="crosshair" />
            <p>{t.goalsFocusEmpty}</p>
          </div>
        </section>

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
    </div>
  );
}
