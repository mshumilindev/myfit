/**
 * Alcohol, "What I drink" (boards A3 list + A4 sheet): the total of what is saved, the
 * region's weekly reference line, and a list of the drink categories. Tapping a row opens the
 * category sheet; nothing is stored until Save is pressed there. A check marks a category
 * that has something saved. No counters, no logging by day. Kit primitives only.
 */
import { useState } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { StickyActionBar } from '../../../components/ui/StickyActionBar';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import {
  ALCOHOL_CATEGORIES,
  activeAlcoholEntries,
  itemsInCategory,
  weeklyGrams,
  standardDrinks,
  type AlcoholCategory,
} from '../../../alcoholCatalog';
import { guidelineFor } from '../../../alcoholRegion';
import { useAlcohol } from '../../../store';
import { AlcoholCategorySheet } from './AlcoholCategorySheet';
import { AlcoholReferenceSheet } from './AlcoholReferenceSheet';
import { ALC_ICON, roundG, useAlcoholText } from './text';

export interface AlcoholProductsViewProps {
  onBack: () => void;
}

export function AlcoholProductsView({ onBack }: AlcoholProductsViewProps) {
  const { t, region, info, regionShort, summaryNames, categorySub, catName } = useAlcoholText();
  const { entries } = useAlcohol();
  const [open, setOpen] = useState<AlcoholCategory | null>(null);
  const [refOpen, setRefOpen] = useState(false);

  const active = activeAlcoholEntries(entries);
  const grams = weeklyGrams(entries);
  const guide = guidelineFor(region);
  const stdFoot = `${t.alcStdFoot(info.drinkWord, info.gramsPerDrink)} ${t.alcOccFoot}`;
  const inCategory = (c: AlcoholCategory) => {
    const ids = new Set(itemsInCategory(c).map((i) => i.id));
    return active.filter((e) => ids.has(e.itemId));
  };

  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.alcHubUse}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <span className="ut-md ut-muted">
            {t.alcListIntro} {t.alcNotListed}
          </span>
          {active.length > 0 && (
            <GroupedList footer={stdFoot}>
              <ListRow
                icon={<IconTile tone="accent" size={30} icon="list-checks" />}
                label={summaryNames(entries)}
                sub={t.alcDrinksAWeek(standardDrinks(grams, region), info.drinkWord)}
                value={`≈ ${t.alcGrams(roundG(grams))}`}
              />
            </GroupedList>
          )}
          <GroupedList header={t.alcListDrinks} footer={active.length > 0 ? undefined : stdFoot}>
            {ALCOHOL_CATEGORIES.map((c) => {
              const list = inCategory(c);
              const sub = categorySub(list);
              return (
                <ListRow
                  key={c}
                  icon={
                    <IconTile
                      tone={list.length ? 'accent' : 'neutral'}
                      size={30}
                      icon={ALC_ICON[c]}
                    />
                  }
                  label={catName(c)}
                  sub={sub ?? t.alcCatHint[c]}
                  check={list.length > 0}
                  chevron
                  onClick={() => setOpen(c)}
                />
              );
            })}
          </GroupedList>
          <GroupedList>
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="scales" />}
              label={t.alcRefRow}
              sub={`${regionShort(region)} · ${t.alcConf[guide.confidence]}`}
              value={`≈ ${t.alcGrams(roundG(guide.weeklyGrams))}`}
              chevron
              onClick={() => setRefOpen(true)}
            />
          </GroupedList>
        </div>
      </div>
      <StickyActionBar variant="page" surface="bg">
        <Button variant="primary" fullWidth onClick={onBack}>
          {t.done}
        </Button>
      </StickyActionBar>
      {open && <AlcoholCategorySheet key={open} category={open} onClose={() => setOpen(null)} />}
      {refOpen && <AlcoholReferenceSheet onClose={() => setRefOpen(false)} />}
    </div>
  );
}
