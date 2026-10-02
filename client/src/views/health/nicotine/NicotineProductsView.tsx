/**
 * Nicotine, "What I use" (boards 2C list + the 2B sheet): a list of the kinds. Tapping a row
 * opens the product sheet with suggested values; nothing is stored until Save is pressed
 * there. A check marks a product that is already saved. Remove (behind a confirm) lives in
 * the sheet. No counters, no logging. Kit primitives only.
 */
import { useState } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { NICOTINE_KINDS, newNicotineProduct } from '../../../nicotine';
import { useNicotine } from '../../../store';
import type { NicotineKind, NicotineProduct } from '../../../types';
import { NicotineProductSheet } from './NicotineProductSheet';
import { NIC_ICON, nicProductId, useNicotineText } from './text';

export interface NicotineProductsViewProps {
  onBack: () => void;
}

export function NicotineProductsView({ onBack }: NicotineProductsViewProps) {
  const { t, kindLabel, aboutText } = useNicotineText();
  const { products } = useNicotine();
  const [open, setOpen] = useState<NicotineKind | null>(null);

  const saved = new Map(products.filter((p) => p.active).map((p) => [p.kind, p]));
  const forSheet = (kind: NicotineKind): NicotineProduct => {
    const cur = products.find((p) => p.kind === kind);
    return cur ? { ...cur, active: true } : newNicotineProduct(kind, nicProductId(kind));
  };

  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.nicHubUse}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <span className="ut-md ut-muted">{t.nicProdIntroList}</span>
          <GroupedList label={t.nicProdProducts}>
            {NICOTINE_KINDS.map(({ kind }) => {
              const p = saved.get(kind);
              return (
                <ListRow
                  key={kind}
                  icon={
                    <IconTile tone={p ? 'accent' : 'neutral'} size={30} icon={NIC_ICON[kind]} />
                  }
                  label={kindLabel(kind)}
                  sub={p ? aboutText(p) : t.nicKindHint[kind]}
                  check={!!p}
                  chevron
                  onClick={() => setOpen(kind)}
                />
              );
            })}
          </GroupedList>
        </div>
      </div>
      {open && (
        <NicotineProductSheet
          key={open}
          product={forSheet(open)}
          isNew={!saved.has(open)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
