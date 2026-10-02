/**
 * Region and units: Auto (detected) or one of EU / US / UK / Australia / Canada. It sets the
 * size of a standard drink, the measures and the weekly reference line. The choice applies at
 * once (like the other settings pickers); Done closes the sheet. Kit only.
 */
import { Button } from '../../../components/ui/Button';
import { IconTile } from '../../../components/ui/IconTile';
import { OptionCard, OptionCardGrid } from '../../../components/ui/OptionCard';
import { Sheet } from '../../../components/ui/Overlays';
import { ALCOHOL_REGIONS, deviceAlcoholRegion, regionInfo } from '../../../alcoholRegion';
import { setAlcoholRegionOverride, useAlcohol } from '../../../store';
import { useAlcoholText } from './text';

export function AlcoholRegionSheet({ onClose }: { onClose: () => void }) {
  const { t, regionName } = useAlcoholText();
  const { settings } = useAlcohol();
  const chosen = settings.regionOverride ?? null;
  const measureOf = (r: (typeof ALCOHOL_REGIONS)[number]) => {
    const i = regionInfo(r);
    return t.alcRegionSub(i.drinkWord, i.gramsPerDrink, t.alcMeasure[i.measure]);
  };
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone="accent" size={40} icon="globe" />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-lg ut-w7">{t.alcHubRegion}</span>
            <span className="ut-sm ut-muted">{t.alcHubRegionBody}</span>
          </div>
        </div>
        <OptionCardGrid label={t.alcHubRegion} columns={1}>
          <OptionCard
            icon={<IconTile tone="accent" size={30} icon="map-pin" />}
            title={t.alcRegionAuto}
            sub={t.alcRegionAutoSub(regionName(deviceAlcoholRegion()))}
            selected={chosen === null}
            onSelect={() => setAlcoholRegionOverride(null)}
          />
          {ALCOHOL_REGIONS.map((r) => (
            <OptionCard
              key={r}
              icon={<IconTile tone="accent" size={30} icon="globe" />}
              title={regionName(r)}
              sub={measureOf(r)}
              selected={chosen === r}
              onSelect={() => setAlcoholRegionOverride(r)}
            />
          ))}
        </OptionCardGrid>
        <Button variant="primary" fullWidth onClick={onClose}>
          {t.done}
        </Button>
      </div>
    </Sheet>
  );
}
