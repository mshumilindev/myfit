/**
 * The weekly reference line of the region, shown for information only: its figure, the source
 * (a short citation, not translated) and how sure the figure is. Never a target or a verdict.
 */
import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Sheet } from '../../../components/ui/Overlays';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Tag } from '../../../components/ui/Tag';
import { guidelineFor } from '../../../alcoholRegion';
import { weeklyGrams } from '../../../alcoholCatalog';
import { useAlcohol } from '../../../store';
import { roundG, useAlcoholText } from './text';

export function AlcoholReferenceSheet({ onClose }: { onClose: () => void }) {
  const { t, region, regionName } = useAlcoholText();
  const { entries } = useAlcohol();
  const g = guidelineFor(region);
  const yours = weeklyGrams(entries);
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone="accent" size={40} icon="scales" />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-lg ut-w7">{t.alcRefTitle}</span>
            <span className="ut-sm ut-muted">{regionName(region)}</span>
          </div>
        </div>
        <span className="ut-md ut-muted">{t.alcRefIntro}</span>
        <GroupedList surface="raised">
          <ListRow
            label={t.alcRefLine}
            value={`≈ ${t.alcGramsAWeek(roundG(g.weeklyGrams))}`}
            valueStrong
          />
          <ListRow label={t.alcRefYours} value={`≈ ${t.alcGramsAWeek(roundG(yours))}`} />
        </GroupedList>
        {g.weeklyGramsHigher != null && (
          <span className="ut-sm ut-muted">{t.alcRefHigher(g.weeklyGramsHigher)}</span>
        )}
        <div>
          <SectionLabel action={<Tag tone="neutral">{t.alcConf[g.confidence]}</Tag>}>
            {t.alcRefSource}
          </SectionLabel>
          <span className="ut-sm ut-muted">{g.source}</span>
        </div>
        <Button variant="primary" fullWidth onClick={onClose}>
          {t.done}
        </Button>
      </div>
    </Sheet>
  );
}
