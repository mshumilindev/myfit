/** Patterns: the person's own rated effort by phase, with honest intervals (docs: «Закономірності»). */
import { useMemo } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Notice } from '../../../components/ui/Notice';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Tag } from '../../../components/ui/Tag';
import { cyclePatterns } from '../../../cycle/cyclePatterns';
import { getLocale } from '../../../i18n';
import { useCycle, useStore } from '../../../store';
import { PHASE_TONE, useCycleText } from './text';

export const fmtRpe = (n: number): string =>
  new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(Math.round(n * 10) / 10);

export function CyclePatternsView({ onBack }: { onBack: () => void }) {
  const { t, phaseName } = useCycleText();
  const cycle = useCycle();
  const { workouts } = useStore();
  const res = useMemo(
    () => (cycle.settings ? cyclePatterns(cycle.starts, cycle.settings, workouts) : null),
    [cycle.starts, cycle.settings, workouts],
  );
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.cycPatterns}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          {!res?.enough ? (
            <EmptyState
              icon="chart-line"
              title={t.cycPatEmptyTitle}
              body={t.cycPatEmptyBody(res?.cycles ?? 0)}
              centered
            />
          ) : (
            <>
              <Notice tone="neutral" icon="info">
                {t.cycPatIntro}
              </Notice>
              <div className="ul-flex ul-col ug-8">
                <SectionLabel>{t.cycPatternsSub}</SectionLabel>
                {res.phases.map((p) => (
                  <Card key={p.phase} pad="md">
                    <div className="ul-flex ul-col ug-4">
                      <div className="ul-flex ua-center ug-8">
                        <Tag tone={PHASE_TONE[p.phase]}>{phaseName[p.phase]}</Tag>
                        <span className="ut-sm ut-muted">{t.cycPatCycles(p.cycles)}</span>
                      </div>
                      <span className="ut-md ut-w6">
                        {t.cycPatRow(fmtRpe(p.diff), fmtRpe(p.lo), fmtRpe(p.hi))}
                      </span>
                      <span className="ut-sm ut-muted">
                        {!p.distinct ? t.cycPatSame : p.diff > 0 ? t.cycPatHigher : t.cycPatLower}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
              <span className="ut-sm ut-muted">{t.cycPatFoot}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
