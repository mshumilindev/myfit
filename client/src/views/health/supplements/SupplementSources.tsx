/**
 * The research behind the numbers: the citation list from `SUPPLEMENT_SOURCES` (short
 * citations are not translated; an unverified one says "approx.") and the evidence sheet
 * (what Strong / Moderate / Weak / None mean, the disclaimer, the sources). Kit only.
 */
import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { Sheet } from '../../../components/ui/Overlays';
import { Tag } from '../../../components/ui/Tag';
import {
  SUPPLEMENT_SOURCES,
  type SupplementEvidence,
  type SupplementSourceKey,
} from '../../../supplementCatalog';
import { EVIDENCE_TONE, useSupplementText } from './text';

const KEYS = Object.keys(SUPPLEMENT_SOURCES) as SupplementSourceKey[];
const LEVELS: (SupplementEvidence | 'none')[] = ['strong', 'moderate', 'weak', 'none'];

/** One row per source: the citation, with "approx." when it was not re-verified. */
export function SupplementSourceList() {
  const { t } = useSupplementText();
  return (
    <GroupedList header={t.supCalcSources}>
      {KEYS.map((k) => (
        <ListRow
          key={k}
          label={SUPPLEMENT_SOURCES[k].cite}
          trailing={
            SUPPLEMENT_SOURCES[k].approx ? <Tag tone="neutral">{t.supCalcApprox}</Tag> : undefined
          }
        />
      ))}
    </GroupedList>
  );
}

export function SupplementEvidenceSheet({ onClose }: { onClose: () => void }) {
  const { t } = useSupplementText();
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone="accent" size={40} icon="book-open" />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-lg ut-w7">{t.supEvTitle}</span>
            <span className="ut-sm ut-muted">{t.supEvidenceRowSub}</span>
          </div>
        </div>
        <span className="ut-md ut-muted">{t.supEvIntro}</span>
        <GroupedList surface="raised">
          {LEVELS.map((l) => (
            <ListRow
              key={l}
              label={<Tag tone={EVIDENCE_TONE[l]}>{t.supEvidence[l]}</Tag>}
              sub={t.supEvLegend[l]}
            />
          ))}
        </GroupedList>
        <Notice tone="neutral" icon="info">
          {t.supDisclaimer}
        </Notice>
        <SupplementSourceList />
        <Button variant="primary" fullWidth onClick={onClose}>
          {t.done}
        </Button>
      </div>
    </Sheet>
  );
}
