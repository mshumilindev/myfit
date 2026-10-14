import type { ComponentType } from 'react';
import { Card } from '../../../components/ui/Card';
import { Chip, ChipGroup } from '../../../components/ui/Chip';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import type { ProgramEditorLabels } from '../labels';
import {
  dayExercises,
  dayMode,
  dayName,
  DOW_OF_ISO,
  dowOf,
  isBare,
  programSets,
  trainingDays,
  type ProgramDoc,
} from '../model/doc';
import { firstName } from './text';

export interface DayStripProps {
  p: ProgramEditorLabels;
  draft: ProgramDoc;
  current: number;
  /** Weekdays (ISO) done together with `partner`; with no partner no day carries a tag. */
  partnerDays: readonly number[];
  partner: string;
  /** Training-week order of weekdays. */
  weekOrder?: readonly number[];
  groupLabels: (day: number) => string;
  /** Muscles-mode days forced by the UI (an emptied day the trainer is defining). */
  onPick: (day: number) => void;
  /** Seven weekday toggles (feature `weekSetup`); absent = none. */
  onToggleDay?: (day: number) => void;
  /** A host tag beside a day (`slots.dayTag`). */
  Tag?: ComponentType<{ day: number }>;
}

/** Training days as cards (a horizontal snap strip on a phone). The day cards ARE the tabs of the day below. */
export function DayStrip({
  p,
  draft,
  current,
  partnerDays,
  partner,
  weekOrder,
  groupLabels,
  onPick,
  onToggleDay,
  Tag,
}: DayStripProps) {
  const days = trainingDays(draft, { weekOrder });
  const trainer = firstName(partner);
  return (
    <section className="pe-days-sec" aria-label={p.edDayTabs}>
      <SectionLabel>{p.edTrainingDays}</SectionLabel>
      {onToggleDay && (
        <ChipGroup className="pe-weekset" aria-label={p.edTrainingDays}>
          {(weekOrder ?? DOW_OF_ISO.map((_, i) => i + 1)).map((d) => {
            const on = days.includes(d);
            return (
              <Chip
                key={d}
                size="xs"
                selected={on}
                icon={on ? 'check' : undefined}
                aria-pressed={on}
                aria-label={p.edTrainOn(p.dowFull[dowOf(d)])}
                onClick={() => onToggleDay(d)}
              >
                {p.dowShort[dowOf(d)]}
              </Chip>
            );
          })}
        </ChipGroup>
      )}
      <div className="pe-days" role="tablist" aria-label={p.edDayTabs}>
        {days.map((d) => {
          const on = d === current;
          const dow = dowOf(d);
          const mode = dayMode(draft, d);
          const lifts = dayExercises(draft, d);
          const bare = lifts.filter((i) => isBare(i)).length;
          const acts = (draft.activities ?? []).filter((a) => a.day === d).length;
          return (
            <Card
              key={d}
              as="button"
              role="tab"
              aria-selected={on}
              pad="none"
              tone={on ? 'accent' : 'neutral'}
              emphasis={on ? 'glass' : 'card'}
              className="pe-day"
              onClick={() => onPick(d)}
            >
              <small className="pe-day-wd">{p.dowShort[dow]}</small>
              <b className="pe-day-name">{dayName(draft, d) || p.dowFull[dow]}</b>
              <span className="pe-day-sum">
                {mode === 'muscles'
                  ? p.edDefinedByMuscles
                  : p.edDayCardSummary(lifts.length, programSets(draft, d))}
              </span>
              {mode === 'muscles' ? (
                <span className="pe-day-mu">{groupLabels(d)}</span>
              ) : bare > 0 ? (
                <span className="pe-day-mu">{p.edWithoutSets(bare)}</span>
              ) : null}
              <span className="pe-day-tags">
                {Tag && <Tag day={d} />}
                {!partner ? null : partnerDays.includes(d) ? (
                  <Chip tone="accent" size="xs" icon="user-focus">
                    {p.edWithTrainer(trainer)}
                  </Chip>
                ) : (
                  <span className="pe-day-solo">{p.edSolo}</span>
                )}
                {acts > 0 && (
                  <Chip size="xs" icon="heartbeat">
                    {p.edActivityN(acts)}
                  </Chip>
                )}
              </span>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
