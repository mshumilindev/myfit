/**
 * Alcohol category sheet (board A4): the drinks of one category. How often (most weeks / from
 * time to time), the type chips, the serving size in the region's measures, "about how many a
 * week" and a read-only readout. Several types of a category can be saved: a chip focuses one
 * type (its controls below); a saved type carries a check. Save is disabled until something
 * changed; Remove (behind a confirm) takes the focused saved type away. From time to time
 * blocks everything except the choice of drink (a small background amount). Kit only.
 */
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { ConfirmDialog, Sheet } from '../../../components/ui/Overlays';
import { PresetChips } from '../../../components/ui/PresetChips';
import { Segmented } from '../../../components/ui/Segmented';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Icon } from '../../../ui';
import { newAlcoholEntry } from '../../../alcohol';
import {
  MAX_SERVINGS_PER_WEEK,
  alcoholItem,
  defaultServingMl,
  describeEntry,
  formatServing,
  itemsInCategory,
  servingPresets,
  type AlcoholCategory,
} from '../../../alcoholCatalog';
import { removeAlcoholEntry, saveAlcoholEntry, useAlcohol } from '../../../store';
import type { AlcoholEntry, AlcoholItemId } from '../../../types';
import { ALC_ICON, alcEntryId, defaultItemOf, numText, roundG, useAlcoholText } from './text';

/** Does the draft differ from the stored entry? The count and serving only matter most weeks. */
const changed = (a: AlcoholEntry, b: AlcoholEntry): boolean =>
  !!a.occasional !== !!b.occasional ||
  (!a.occasional && (a.servingMl !== b.servingMl || a.servingsPerWeek !== b.servingsPerWeek));

export function AlcoholCategorySheet({
  category,
  onClose,
}: {
  category: AlcoholCategory;
  onClose: () => void;
}) {
  const { t, region, info, itemName, catName, servingText } = useAlcoholText();
  const { entries } = useAlcohol();
  const items = itemsInCategory(category);
  // The saved state when the sheet opened: dirty is measured against it.
  const [saved] = useState(() => {
    const ids = new Set(items.map((i) => i.id));
    return new Map(entries.filter((e) => e.active && ids.has(e.itemId)).map((e) => [e.itemId, e]));
  });
  const [focus, setFocus] = useState<AlcoholItemId>(
    () => items.find((i) => saved.has(i.id))?.id ?? defaultItemOf(category),
  );
  const [drafts, setDrafts] = useState<Partial<Record<AlcoholItemId, AlcoholEntry>>>({});
  const [touched, setTouched] = useState<readonly AlcoholItemId[]>([]);
  const [confirm, setConfirm] = useState(false);

  const draftOf = (id: AlcoholItemId): AlcoholEntry =>
    drafts[id] ??
    saved.get(id) ??
    newAlcoholEntry(id, alcEntryId(id), defaultServingMl(alcoholItem(id), region));
  const draft = draftOf(focus);
  const item = alcoholItem(focus);
  const occasional = !!draft.occasional;

  /** The types Save writes: the focused one, plus any other that was edited. */
  const toSave = items
    .map((i) => i.id)
    .filter((id) => {
      const s = saved.get(id);
      if (!s) return id === focus || touched.includes(id);
      return changed(draftOf(id), s);
    });
  const dirty = toSave.length > 0;

  const patch = (p: Partial<AlcoholEntry>) => {
    setDrafts((d) => ({ ...d, [focus]: { ...draftOf(focus), ...p } }));
    setTouched((x) => (x.includes(focus) ? x : [...x, focus]));
  };
  /** The other mode's values stay in the draft, so toggling back and forth loses nothing. */
  const setOccasional = (on: boolean) => {
    const next = { ...draftOf(focus) };
    if (on) next.occasional = true;
    else delete next.occasional;
    setDrafts((d) => ({ ...d, [focus]: next }));
    setTouched((x) => (x.includes(focus) ? x : [...x, focus]));
  };
  const save = () => {
    if (!dirty) return;
    for (const id of toSave) saveAlcoholEntry({ ...draftOf(id), active: true });
    onClose();
  };

  const presets = servingPresets(item, region);
  const servingOptions = presets.some((p) => p.ml === draft.servingMl)
    ? presets
    : [...presets, { ml: draft.servingMl, ...formatServing(draft.servingMl, region) }].sort(
        (a, b) => a.ml - b.ml,
      );
  const desc = describeEntry(draft, region);

  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone="accent" size={40} icon={ALC_ICON[category]} />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-lg ut-w7">{catName(category)}</span>
            <span className="ut-sm ut-muted">{t.alcCatHint[category]}</span>
          </div>
        </div>
        <Segmented
          label={t.nicHowOften}
          variant="track"
          value={occasional ? 'some' : 'most'}
          onChange={(v) => setOccasional(v === 'some')}
          options={[
            { value: 'most', label: t.alcFreqMost },
            { value: 'some', label: t.nicFreqSome },
          ]}
        />
        {items.length > 1 && (
          <div>
            <SectionLabel>{t.alcType}</SectionLabel>
            <PresetChips
              label={t.alcType}
              items={items.map((i) => ({
                id: i.id,
                label: (
                  <>
                    {saved.has(i.id) && (
                      <>
                        <Icon name="check" />
                        <span className="visually-hidden">{t.alcSaved}</span>
                      </>
                    )}
                    {`${itemName(i.id)} · ${numText(i.abv)}%`}
                  </>
                ),
                selected: i.id === focus,
                onClick: () => setFocus(i.id),
              }))}
            />
            <span className="ut-sm ut-muted">{t.alcNotListed}</span>
          </div>
        )}
        {!occasional && (
          <div>
            <SectionLabel>{t.alcServingSize}</SectionLabel>
            <Segmented
              label={t.alcServingSize}
              variant="track"
              value={draft.servingMl}
              onChange={(servingMl) => patch({ servingMl })}
              options={servingOptions.map((p) => ({
                value: p.ml,
                label: servingText(p),
                compact: servingOptions.length > 3,
              }))}
            />
          </div>
        )}
        {!occasional && (
          <NumberStepper
            label={t.alcAbout}
            value={draft.servingsPerWeek}
            onChange={(servingsPerWeek) => patch({ servingsPerWeek })}
            step={1}
            decimals={0}
            min={1}
            max={MAX_SERVINGS_PER_WEEK}
            unit={t.alcServingsUnit}
          />
        )}
        {occasional && <span className="ut-sm ut-muted">{t.alcOccHelp}</span>}
        {desc && (
          <GroupedList surface="raised">
            <ListRow label={t.alcStrength} value={t.alcAbv(numText(item.abv))} />
            {!occasional && (
              <ListRow
                label={t.alcOneServing}
                value={`${t.alcGrams(roundG(desc.gramsPerServing))} · ${t.alcDrinks(desc.drinksPerServing, info.drinkWord)}`}
              />
            )}
            <ListRow
              label={t.alcFromThis}
              value={`≈ ${t.alcGramsAWeek(roundG(desc.gramsPerWeek))}`}
              valueStrong
            />
          </GroupedList>
        )}
        <Button variant="primary" fullWidth disabled={!dirty} onClick={save}>
          {t.nicSave}
        </Button>
        {saved.has(focus) && (
          <GroupedList surface="raised">
            <ListRow action tone="danger" label={t.alcRemove} onClick={() => setConfirm(true)} />
          </GroupedList>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={t.alcRemoveAsk}
          body={t.alcRemoveBody(itemName(focus))}
          confirmLabel={t.nicRemoveConfirm}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            removeAlcoholEntry(saved.get(focus)?.id ?? alcEntryId(focus));
            setConfirm(false);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
