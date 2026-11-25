import { useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { Notice } from '../components/ui/Notice';
import { PageHead } from '../components/ui/PageHead';
import { Tag } from '../components/ui/Tag';
import { useAddonStoreT } from '../i18n/addonStore';
import type { CatalogEntry, CatalogNeed } from './catalog/types';
import { missingNeeds } from './filters';
import type { TlStrings } from './strings';
import { metaLine } from './meta';

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
              label={s.weekdays[d - 1]}
              sub={
                e.dayNames[String(d)]
                  ? `${e.dayNames[String(d)]} · ${s.exercises(n)}`
                  : s.exercises(n)
              }
            />
          ))}
        </GroupedList>
        <GroupedList header={s.source}>
          <ListRow label={e.origin.label} sub={s.origin[e.origin.kind]} />
          <ListRow label={s.notVerified} />
        </GroupedList>
        <p className="tl-fine">{s.disclaimer}</p>
      </div>
    </div>
  );
}
