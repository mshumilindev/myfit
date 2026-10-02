/**
 * Supplements quick start (board E2): six big tiles for what most people take, with typical
 * doses and timing filled in. "Save N supplements" saves the picked ones; "Fine-tune and add
 * more" saves them too and opens the catalog. It is the first thing a person with no entries
 * sees (and what the onboarding row opens). Kit only.
 */
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { IconTile } from '../../../components/ui/IconTile';
import { OptionCard, OptionCardGrid } from '../../../components/ui/OptionCard';
import { Sheet } from '../../../components/ui/Overlays';
import { supplementItem } from '../../../supplementCatalog';
import { newSupplementEntry } from '../../../supplements';
import { saveSupplementEntry, useSupplements } from '../../../store';
import type { SupplementId } from '../../../types';
import { supEntryId, useSupplementText } from './text';

/** The six tiles: the item each one saves. */
export const QUICK_ITEMS: readonly SupplementId[] = [
  'creatine',
  'whey',
  'caffeine',
  'magnesium',
  'vitaminD',
  'omega3',
];

export function SupplementQuickStartSheet({
  onClose,
  onMore,
}: {
  onClose: () => void;
  /** Open the catalog ("Fine-tune and add more"), after saving the picked ones. */
  onMore: () => void;
}) {
  const { t, entryText } = useSupplementText();
  const { entries } = useSupplements();
  const have = new Set(entries.filter((e) => e.active).map((e) => e.itemId));
  const [picked, setPicked] = useState<readonly SupplementId[]>([]);
  const toggle = (id: SupplementId) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const saveAll = () => {
    for (const id of picked) saveSupplementEntry(newSupplementEntry(id, supEntryId(id)));
  };
  const title = (id: SupplementId): string =>
    id === 'whey' ? t.supQuickProtein : id === 'caffeine' ? t.supQuickCaffeine : t.supItemShort[id];
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ul-col ug-4">
          <h2 className="ut-xl ut-w7">{t.supQuickTitle}</h2>
          <span className="ut-sm ut-muted">{t.supQuickSub}</span>
        </div>
        <OptionCardGrid label={t.supQuickAria} columns={2}>
          {QUICK_ITEMS.map((id) => {
            const item = supplementItem(id);
            const on = have.has(id) || picked.includes(id);
            const e = newSupplementEntry(id, supEntryId(id));
            return (
              <OptionCard
                key={id}
                preview={
                  <span className="ul-flex uj-center uw-full">
                    <IconTile tone={on ? 'accent' : 'neutral'} size={48} icon={item.icon} />
                  </span>
                }
                title={title(id)}
                sub={have.has(id) ? t.supQuickSaved : entryText(e)}
                selected={on}
                disabled={have.has(id)}
                onSelect={() => toggle(id)}
              />
            );
          })}
        </OptionCardGrid>
        <Button
          variant="primary"
          fullWidth
          disabled={picked.length === 0}
          onClick={() => {
            saveAll();
            onClose();
          }}
        >
          {t.supQuickSave(picked.length)}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          iconTrailing="arrow-right"
          onClick={() => {
            saveAll();
            onMore();
          }}
        >
          {t.supQuickMore}
        </Button>
      </div>
    </Sheet>
  );
}
