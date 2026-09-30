/**
 * "Recovery fuel" on the Session summary: up to two generic food / drink ideas
 * for after this workout, each with a one-line reason read from how it went
 * ("12 working sets on legs, RPE 8.5 — easy protein to support recovery").
 * What to show is decided by the pure `postWorkoutFuel.ts`; with a diet-relevant
 * active condition the card shows a neutral "check with your doctor or dietitian".
 */
import { useMemo } from 'react';
import { useStore } from '../../store';
import { useT } from '../../i18n';
import { Icon } from '../../ui';
import { Card } from '../../components/ui/Card';
import { IconTile } from '../../components/ui/IconTile';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { postWorkoutFuel, type FuelItem, type FuelResult } from '../../postWorkoutFuel';
import type { Workout } from '../../types';
import { nowMs } from '../logActivity/shared';
import './FuelCard.css';

const ICON: Record<FuelItem['kind'], string> = {
  proteinShake: 'barbell',
  smoothie: 'fork-knife',
  hydrate: 'drop',
  carbMeal: 'fork-knife',
  snack: 'fork-knife',
};

/** Which facts explain each idea (zeros / null are left out of the sentence). */
function factsFor(kind: FuelItem['kind'], f: FuelResult['facts']) {
  const strength = { sets: f.strengthSets, dayType: f.dayType };
  switch (kind) {
    case 'proteinShake':
      return { ...strength, rpe: f.avgRpe, minutes: 0, cardioMin: 0 };
    case 'carbMeal':
      return { ...strength, rpe: f.avgRpe, minutes: f.minutes, cardioMin: 0 };
    case 'hydrate':
      return { sets: 0, dayType: null, rpe: f.avgRpe, minutes: f.minutes, cardioMin: f.cardioMin };
    case 'smoothie':
      return f.cardioMin > 0
        ? { sets: 0, dayType: null, rpe: null, minutes: f.minutes, cardioMin: f.cardioMin }
        : { ...strength, rpe: null, minutes: f.minutes, cardioMin: 0 };
    default:
      return { ...strength, rpe: null, minutes: f.minutes, cardioMin: 0 };
  }
}

export function FuelCard({ workout }: { workout: Workout }) {
  const { t } = useT();
  const store = useStore();
  const gym = workout.gymId ? (store.gyms.find((g) => g.id === workout.gymId) ?? null) : null;
  const fuel = useMemo(
    () =>
      postWorkoutFuel({
        workout,
        gym,
        conditions: store.conditions,
        now: workout.finishedAt ?? nowMs(),
      }),
    [workout, gym, store.conditions],
  );
  if (!fuel) return null;

  const factsLine = (kind: FuelItem['kind']): string => {
    const f = factsFor(kind, fuel!.facts);
    return t.fuelFacts(f.sets, f.dayType, f.rpe, f.minutes, f.cardioMin);
  };

  if (fuel.mode === 'consult') {
    return (
      <Card as="section" className="fuel-card" aria-labelledby="fuel-t">
        <SectionLabel id="fuel-t">{t.fuelTitle}</SectionLabel>
        <div className="fuel-row">
          <IconTile tone="chronic" size={36} icon="info" />
          <div className="fuel-body">
            <p className="ut-base ut-w6">{t.fuelConsultTitle}</p>
            <p className="ut-sm ut-dim">{t.fuelConsult}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card as="section" className="fuel-card" aria-labelledby="fuel-t">
      <SectionLabel id="fuel-t">{t.fuelTitle}</SectionLabel>
      <ul className="fuel-list">
        {fuel.items.map((it) => (
          <li key={it.kind} className="fuel-row" data-kind={it.kind}>
            <IconTile tone="accent" size={36} icon={ICON[it.kind]} />
            <div className="fuel-body">
              <p className="ut-base ut-w6">{t.fuelName(it.kind)}</p>
              <p className="ut-sm ut-dim">{t.fuelReason(it.kind, factsLine(it.kind))}</p>
              {it.atGym && (
                <p className="fuel-gym ut-xs">
                  <Icon name="check" />
                  {t.fuelAtGym}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="ut-xs ut-faint">{t.fuelNote}</p>
    </Card>
  );
}
