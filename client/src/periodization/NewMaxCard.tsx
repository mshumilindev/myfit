/**
 * "New max?" on the summary of a session done in a TEST week (Periodization chunk). Only for an exercise whose max the person
 * typed: when their history now implies more than they typed, one tap raises it. A max taken from history needs no question
 * (it already follows the history).
 */
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useProgramMine } from '../data/programMine';
import { useT } from '../i18n';
import type { Workout } from '../types';
import { activeWeekLabel } from './cycle';
import { estimatedMax } from './maxes';
import { saveMax, useTypedMaxes } from './maxesSync';
import { maxKey } from './maxesData';
import { fill, STRINGS } from './strings';
import type { WeekSource } from '../periodizationApi';
import './periodization.css';

export function NewMaxCard({ workout }: { workout: Workout }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const { assignment } = useProgramMine();
  const typed = useTypedMaxes();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);
  if (hidden || !assignment) return null;
  if (activeWeekLabel(assignment.program as unknown as WeekSource, assignment.week) !== 'test')
    return null;
  const rows = workout.exercises
    .filter((ex) => ex.sets.some((x) => !x.isWarmup))
    .flatMap((ex) => {
      const old = typed.maxes[maxKey(ex.name)]?.kg;
      const est = old === undefined ? null : estimatedMax(ex.name);
      return old !== undefined && est !== null && est > old ? [{ name: ex.name, old, est }] : [];
    });
  if (rows.length === 0) return null;
  return (
    <Card tone="accent" pad="md" className="pd-newmax">
      <b>{s.newMaxTitle}</b>
      {rows.map((r) => (
        <div key={r.name} className="pd-newmax-row">
          <span>{fill(s.newMaxRow, { name: r.name, old: r.old, new: r.est })}</span>
          {done.has(r.name) ? (
            <span className="ut-xs ut-faint">{s.newMaxSaved}</span>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                void saveMax(r.name, r.est).then(() => setDone((d) => new Set(d).add(r.name)))
              }
            >
              {s.newMaxUpdate}
            </Button>
          )}
        </div>
      ))}
      <Button variant="link" size="sm" onClick={() => setHidden(true)}>
        {s.newMaxLater}
      </Button>
    </Card>
  );
}
