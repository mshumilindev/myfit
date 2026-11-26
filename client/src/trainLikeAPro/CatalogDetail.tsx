import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { Notice } from '../components/ui/Notice';
import { Sheet, SheetPin } from '../components/ui/Overlays';
import { PageHead } from '../components/ui/PageHead';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Tag } from '../components/ui/Tag';
import { useAddonStoreT } from '../i18n/addonStore';
import type { CatalogEntry, CatalogNeed } from './catalog/types';
import { missingNeeds } from './filters';
import type { TlStrings } from './strings';
import { metaLine } from './meta';
import { describeProgram, isWeekdayName } from './description';

/**
 * One program: who, the facts, the one action, the week and where it comes from. A program that needs an add-on that is not
 * installed stays readable; its action is "Get …" instead of Start. Nothing here edits the program.
 */
export function CatalogDetail(p: {
  entry: CatalogEntry;
  installed: ReadonlySet<string>;
  s: TlStrings;
  /** A trainer's program is active: it cannot be replaced, so Start is off and says why. */
  heldHint?: string;
  starting?: boolean;
  /** A result worth a line (saved offline, could not start). */
  note?: string;
  onBack: () => void;
  onStart?: (e: CatalogEntry) => void;
  onGetAddon?: (id: CatalogNeed) => void;
}) {
  const { entry: e, s } = p;
  const { st } = useAddonStoreT();
  /** The day's own name, unless the source only repeats the weekday. */
  const dayName = (d: number) => {
    const n = e.dayNames[String(d)];
    return n && !isWeekdayName(n) && n !== s.weekdays[d - 1] ? n : undefined;
  };
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [readMore, setReadMore] = useState(false);
  const desc = useMemo(() => describeProgram(e, s), [e, s]);
  const missing = missingNeeds(e, p.installed);
  const name = (id: CatalogNeed) => st.items[id].name;
  const days = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const r of e.items) byDay.set(r.day, (byDay.get(r.day) ?? 0) + 1);
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  }, [e]);

  return (
    <div className="screen">
      <div className="tl-page tl-detail">
        <PageHead back={{ label: s.back, onClick: p.onBack }} title={e.who} sub={e.title} />
        <div className="tl-tags">
          <Tag>{metaLine(e, s)}</Tag>
          {e.levels.map((l) => (
            <Tag key={l}>{s.level[l]}</Tag>
          ))}
        </div>
        <div className="tl-about">
          <p className="tl-lead">{desc.lead}</p>
          {readMore && desc.more.map((t) => <p key={t}>{t}</p>)}
          <Button variant="link" onClick={() => setReadMore((v) => !v)}>
            {readMore ? s.readLess : s.readMore}
          </Button>
        </div>
        {e.elite && (
          <Notice tone="rest" icon="warning">
            {s.eliteWarning}
          </Notice>
        )}
        {missing.length > 0 ? (
          <>
            <Notice tone="rest" icon="info">
              {s.lockedBody(missing.map(name).join(', '))}
            </Notice>
            <Button fullWidth onClick={() => p.onGetAddon?.(missing[0])}>
              {s.get(name(missing[0]))}
            </Button>
          </>
        ) : (
          <>
            {p.note && (
              <Notice tone="rest" icon="info">
                {p.note}
              </Notice>
            )}
            <Button
              fullWidth
              loading={p.starting}
              disabled={!!p.heldHint}
              onClick={() => p.onStart?.(e)}
            >
              {s.start}
            </Button>
            {p.heldHint && <p className="tl-fine">{p.heldHint}</p>}
          </>
        )}
        <GroupedList header={s.week}>
          {days.map(([d, n]) => (
            <ListRow
              key={d}
              chevron
              onClick={() => setOpenDay(d)}
              label={s.weekdays[d - 1]}
              sub={dayName(d) ? `${dayName(d)} · ${s.exercises(n)}` : s.exercises(n)}
            />
          ))}
        </GroupedList>
        <div>
          <SectionLabel>{s.source}</SectionLabel>
          <p className="tl-fine">
            {e.origin.label} · {s.origin[e.origin.kind]}
          </p>
        </div>
      </div>
      {openDay != null && (
        <Sheet onClose={() => setOpenDay(null)} label={s.weekdays[openDay - 1]} closeLabel={s.back}>
          <SheetPin>
            <h3 className="title-20">{s.weekdays[openDay - 1]}</h3>
            {dayName(openDay) && <p className="tl-fine">{dayName(openDay)}</p>}
          </SheetPin>
          <GroupedList surface="raised">
            {e.items
              .filter((r) => r.day === openDay)
              .sort((a, b) => a.position - b.position)
              .map((r) => (
                <ListRow
                  key={`${r.day}-${r.position}`}
                  label={r.name}
                  value={r.bare ? undefined : `${r.sets}×${r.reps}`}
                />
              ))}
          </GroupedList>
        </Sheet>
      )}
    </div>
  );
}
