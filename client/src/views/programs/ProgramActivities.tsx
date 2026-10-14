/** Planned activities of a program, read only: the short line and the chip row for a rest day. Editing is the tool's. */
import { activityType } from '../../activities';
import { useT } from '../../i18n';
import { Chip } from '../../components/ui/Chip';
import type { ProgramActivity } from './model';

/** "Run · 20 min" — the short form used by chips and rows. */
export function useActivityLine() {
  const { t } = useT();
  return (a: ProgramActivity, withWhen = false) =>
    `${t.actType[a.type] ?? a.type} · ${a.minutes} ${t.minShort}${
      withWhen && a.when !== 'any' ? ` · ${t.pgActWhen[a.when]}` : ''
    }`;
}

/** The week overview's per-day chips (read-only). */
export function ActivityChips({ list }: { list: ProgramActivity[] }) {
  const line = useActivityLine();
  if (!list.length) return null;
  return (
    <div className="pg-actchips">
      {list.map((a) => (
        <Chip key={a.id} size="xs" icon={activityType(a.type)?.icon ?? 'heartbeat'}>
          {line(a)}
        </Chip>
      ))}
    </div>
  );
}
