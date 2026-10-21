import { Select } from '../../components/ui/Select';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import type { ManagerSchedule } from './managerSchedule';
import type { People } from './people';
import type { ScheduleParamsApi } from './useScheduleParams';
import { gymName, type Gym } from './types';

export interface ScheduleFiltersProps {
  t: ScheduleStrings;
  wide: boolean;
  prm: ScheduleParamsApi;
  gyms: readonly Gym[];
  people: People;
  /** a manager: no Gym filter, a Trainer filter instead */
  team: ManagerSchedule | null;
}

/** The toolbar filters: Gym (trainer only), Client and, for a manager, Trainer (after the calendar view). */
export function ScheduleFilters({ t, wide, prm, gyms, people, team }: ScheduleFiltersProps) {
  return (
    <div className="sc-toolbar-filters">
      {team && (
        <Select
          labelInline={wide}
          label={t.scTrainerLabel}
          value={prm.trainer ?? ''}
          onChange={(e) => prm.set({ trainer: e.target.value || null, open: null })}
        >
          <option value="">{t.scAllTrainers}</option>
          {team.trainers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      )}
      {!team && (
        <Select
          labelInline={wide}
          label={t.scGymLabel}
          value={prm.gym ?? ''}
          onChange={(e) => prm.set({ gym: e.target.value || null, open: null })}
        >
          <option value="">{t.scAllGyms}</option>
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {gymName(g.id)}
            </option>
          ))}
        </Select>
      )}
      <Select
        labelInline={wide}
        label={t.scClientLabel}
        value={prm.who ?? ''}
        onChange={(e) => prm.set({ who: e.target.value || null, open: null })}
      >
        <option value="">{t.scAllClients}</option>
        {people.list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** The failure notice text for the store's `failed` code. */
export function failText(failed: string | null | undefined, t: ScheduleStrings): string | null {
  switch (failed) {
    case 'save':
      return t.scFailSave;
    case 'conflict':
      return t.scFailConflict;
    case 'request':
      return t.scFailRequest;
    case 'answer':
      return t.scFailAnswer;
    case 'expired':
      return t.scFailExpired;
    case 'vault-locked':
      return t.scFailVault;
    case 'limit':
      return t.scFailLimit;
    default:
      return null;
  }
}
