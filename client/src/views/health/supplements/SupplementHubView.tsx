/**
 * Supplements hub (board A2): "What I take", "Schedule" (opens the same list),
 * "Ask me on Today" and "Use in calculations", then the safety Notices of what is saved.
 * Sharing and delete live in Health › Privacy and sharing. Kit primitives only.
 */
import { useMemo } from 'react';
import { PageHead } from '../../../components/ui/PageHead';
import { HealthDisclaimer } from '../../../legal/HealthDisclaimer';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Switch } from '../../../components/ui/Switch';
import { activeSupplementEntries, scheduleCounts } from '../../../supplementCatalog';
import { setSupplementCheckinsOn, useSupplements } from '../../../store';
import { supplementWarnings } from '../../../supplements';
import { supplementContext } from '../../../supplementsApply';
import { SupplementWarnings } from './SupplementWarnings';
import { useSupplementText } from './text';

export type SupplementScreen = 'hub' | 'products' | 'calc';

export function SupplementHubView({
  onOpen,
  onBack,
}: {
  onOpen: (screen: Exclude<SupplementScreen, 'hub'>) => void;
  onBack: () => void;
}) {
  const { t, summary } = useSupplementText();
  const { entries, settings } = useSupplements();
  const counts = scheduleCounts(entries);
  const warnings = useMemo(() => supplementWarnings({ entries }, supplementContext()), [entries]);
  const any = activeSupplementEntries(entries).length > 0;
  return (
    <div className="screen hl">
      <PageHead
        className="hl-pbar"
        back={{ label: t.backAction, onClick: onBack }}
        title={t.supTitle}
      />
      <div className="hl-scroll">
        <div className="hl-cnt">
          <HealthDisclaimer />
          <GroupedList footer={t.supHubFoot}>
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="list-checks" />}
              label={t.supHubUse}
              sub={summary(entries) ?? t.supRowEmpty}
              chevron
              onClick={() => onOpen('products')}
            />
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="calendar-dots" />}
              label={t.supHubSchedule}
              sub={
                any ? t.supHubScheduleVal(counts.daily, counts.trainingDays) : t.supHubScheduleNone
              }
              chevron
              onClick={() => onOpen('products')}
            />
            <ListRow
              as="label"
              icon={<IconTile tone="neutral" size={30} icon="bell-ringing" />}
              label={t.supHubAsk}
              sub={t.supHubAskSub}
              trailing={
                <Switch
                  checked={settings.checkinsOn}
                  onChange={setSupplementCheckinsOn}
                  aria-label={t.supHubAsk}
                />
              }
            />
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="gauge" />}
              label={t.nicHubCalc}
              value={settings.useInCalculations ? t.nicHubOn : t.nicHubOff}
              chevron
              onClick={() => onOpen('calc')}
            />
          </GroupedList>
          <SupplementWarnings warnings={warnings} />
        </div>
      </div>
    </div>
  );
}
