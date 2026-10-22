import { useT } from '../i18n';
import { Icon } from '../ui';

export function SetupStepper({ active }: { active: 1 | 2 | 3 }) {
  const { t } = useT();
  return (
    <div className="step">
      <span className={`s${active === 1 ? ' on' : active > 1 ? ' done' : ''}`}>
        <span className="n">{active > 1 ? <Icon name="check" weight="bold" /> : 1}</span>
        {t.injStepWhere}
      </span>
      <span className="line" />
      <span className={`s${active === 2 ? ' on' : active > 2 ? ' done' : ''}`}>
        <span className="n">{active > 2 ? <Icon name="check" weight="bold" /> : 2}</span>
        {t.injStepFeel}
      </span>
      <span className="line" />
      <span className={`s${active === 3 ? ' on' : ''}`}>
        <span className="n">3</span>
        {t.injStepPlan}
      </span>
    </div>
  );
}
