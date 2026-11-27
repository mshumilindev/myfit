import { SkBtn, SkRow, SkTile } from '../store-kit';
import { StoreSurface } from '../addonStore/StoreSurface';
import { iconUrl } from '../addonStore/storeItems';
import { useT } from '../i18n';

/**
 * The "Advanced training" store row at the foot of the set-options sheet, shown only while the item is offered and not
 * installed (owner decision 26.11, an exception to "no install hints in calculation screens", addons.md).
 * It is the store's own row, so it carries the store kit's colours: the class follows the app's light / dark mode.
 */
export function AdvancedNudge({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  return (
    <StoreSurface className="opts-nudge">
      <SkRow
        noBorder
        tile={<SkTile letter="A" tone={3} size={40} image={iconUrl('advanced-training')} />}
        name={t.advNudgeName}
        desc={t.advNudgeDesc}
        action={
          <SkBtn kind="tint" size="s" onClick={onOpen}>
            {t.advNudgeAdd}
          </SkBtn>
        }
        onOpen={onOpen}
      />
    </StoreSurface>
  );
}
