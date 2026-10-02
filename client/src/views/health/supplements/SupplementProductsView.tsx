/**
 * Supplements, "What I take" (boards A3 list + A4 sheet): the total of what is saved and the
 * four catalog groups. Tapping a group opens its sheet; nothing is stored until Save is
 * pressed there. A check marks a group that has something saved. No counters, no logging by
 * day. Kit primitives only.
 */
import { useState } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { StickyActionBar } from '../../../components/ui/StickyActionBar';
import {
  GROUP_ICONS,
  SUPPLEMENT_GROUPS,
  activeSupplementEntries,
  entriesInGroup,
  scheduleCounts,
} from '../../../supplementCatalog';
import { useSupplements } from '../../../store';
import type { SupplementGroup } from '../../../types';
import { SupplementEvidenceSheet } from './SupplementSources';
import { SupplementGroupSheet } from './SupplementGroupSheet';
import { useSupplementText } from './text';

export function SupplementProductsView({ onBack }: { onBack: () => void }) {
  const { t, groupName, groupSub, summaryNames } = useSupplementText();
  const { entries } = useSupplements();
  const [open, setOpen] = useState<SupplementGroup | null>(null);
  const [evOpen, setEvOpen] = useState(false);
  const active = activeSupplementEntries(entries);
  const counts = scheduleCounts(entries);
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.supHubUse}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <span className="ut-md ut-muted">{t.supListIntro}</span>
          {active.length > 0 && (
            <GroupedList>
              <ListRow
                icon={<IconTile tone="accent" size={30} icon="list-checks" />}
                label={summaryNames(entries)}
                sub={t.supListSummarySub(active.length, counts.daily)}
              />
            </GroupedList>
          )}
          <GroupedList header={t.supListGroups} footer={t.supListFoot}>
            {SUPPLEMENT_GROUPS.map((g) => {
              const list = activeSupplementEntries(entriesInGroup(entries, g));
              return (
                <ListRow
                  key={g}
                  icon={
                    <IconTile
                      tone={list.length ? 'accent' : 'neutral'}
                      size={30}
                      icon={GROUP_ICONS[g]}
                    />
                  }
                  label={groupName(g)}
                  sub={groupSub(list) ?? t.supGroupBlurb[g]}
                  check={list.length > 0}
                  chevron
                  onClick={() => setOpen(g)}
                />
              );
            })}
          </GroupedList>
          <GroupedList>
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="book-open" />}
              label={t.supEvidenceRow}
              sub={t.supEvidenceRowSub}
              chevron
              onClick={() => setEvOpen(true)}
            />
          </GroupedList>
        </div>
      </div>
      <StickyActionBar variant="page" surface="bg">
        <Button variant="primary" fullWidth onClick={onBack}>
          {t.done}
        </Button>
      </StickyActionBar>
      {open && <SupplementGroupSheet key={open} group={open} onClose={() => setOpen(null)} />}
      {evOpen && <SupplementEvidenceSheet onClose={() => setEvOpen(false)} />}
    </div>
  );
}
