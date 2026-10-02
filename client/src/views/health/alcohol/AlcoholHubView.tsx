/**
 * Alcohol hub (board A2): "What I drink", "Usual days", "Ask me on Today", "Use in calculations" and the
 * region row. Each opens its own page (the region one a picker sheet). Sharing and delete
 * live in Health › Privacy and sharing. Kit primitives only.
 */
import { useState } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Switch } from '../../../components/ui/Switch';
import { getAlcoholWeekActual, setAlcoholCheckinsOn, useAlcohol } from '../../../store';
import { useWeekStartDay } from '../../../weekStart';
import { AlcoholRegionSheet } from './AlcoholRegionSheet';
import { roundG, useAlcoholText } from './text';

export type AlcoholScreen = 'hub' | 'products' | 'days' | 'calc';

export function AlcoholHubView({
  onOpen,
  onBack,
}: {
  onOpen: (screen: Exclude<AlcoholScreen, 'hub'>) => void;
  onBack: () => void;
}) {
  const { t, summary, daysText, region, regionShort } = useAlcoholText();
  const { entries, settings, checkins } = useAlcohol();
  const weekStart = useWeekStartDay();
  const [regionOpen, setRegionOpen] = useState(false);
  // Read-only: what the user's own answers on Today add up to this week (only once any exist).
  const hasAnswers = Object.keys(checkins ?? {}).length > 0;
  const week = hasAnswers ? getAlcoholWeekActual(undefined, weekStart) : null;
  const hasDays = settings.usualDays.length > 0;
  const regionValue = settings.regionOverride
    ? regionShort(settings.regionOverride)
    : `${t.alcRegionAuto} · ${regionShort(region)}`;
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.alcTitle}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <GroupedList footer={t.nicHubFoot}>
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="list-checks" />}
              label={t.alcHubUse}
              sub={summary(entries) ?? t.alcRowEmpty}
              chevron
              onClick={() => onOpen('products')}
            />
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="calendar-dots" />}
              label={t.alcHubDays}
              sub={daysText(settings.usualDays)}
              chevron
              onClick={() => onOpen('days')}
            />
            <ListRow
              as="label"
              dim={!hasDays}
              icon={<IconTile tone="neutral" size={30} icon="bell-ringing" />}
              label={t.supHubAsk}
              sub={hasDays ? t.alcHubAskSub : t.alcHubAskNeedDays}
              trailing={
                <Switch
                  checked={settings.checkinsOn && hasDays}
                  disabled={!hasDays}
                  onChange={setAlcoholCheckinsOn}
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
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="globe" />}
              label={t.alcHubRegion}
              value={regionValue}
              chevron
              onClick={() => setRegionOpen(true)}
            />
          </GroupedList>
          {week && (
            <GroupedList>
              <ListRow
                icon={<IconTile tone="neutral" size={30} icon="calendar-check" />}
                label={t.alcWeekSoFar(roundG(week.grams))}
              />
            </GroupedList>
          )}
        </div>
      </div>
      {regionOpen && <AlcoholRegionSheet onClose={() => setRegionOpen(false)} />}
    </div>
  );
}
