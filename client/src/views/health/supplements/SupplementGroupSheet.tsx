/**
 * Supplements group sheet (board A4): the supplements of one catalog group. Daily / Training
 * days, the item chips, the serving (presets plus an exact stepper), the timing, a read-only
 * readout (typical serving, evidence, what it does in your numbers) and the safety Notices.
 * Several items of a group can be saved: a chip focuses one item (its controls below); a saved
 * item carries a check. Save is disabled until something changed; Remove (behind a confirm)
 * takes the focused saved item away. Effects are measured from when an item is first saved,
 * so there is no date field. Kit only.
 */
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { ConfirmDialog, Sheet } from '../../../components/ui/Overlays';
import { PresetChips } from '../../../components/ui/PresetChips';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Segmented } from '../../../components/ui/Segmented';
import { Tag } from '../../../components/ui/Tag';
import { Icon } from '../../../ui';
import {
  GROUP_ICONS,
  TIMINGS,
  caffeineMgOf,
  clampDose,
  itemsInGroup,
  supplementItem,
} from '../../../supplementCatalog';
import {
  SUPPLEMENT_EFFECT_KEYS,
  isNeutralRange,
  newSupplementEntry,
  supplementWarnings,
} from '../../../supplements';
import { supplementContext } from '../../../supplementsApply';
import { removeSupplementEntry, saveSupplementEntry, useSupplements } from '../../../store';
import type { SupplementEntry, SupplementGroup, SupplementId } from '../../../types';
import { SupplementWarnings } from './SupplementWarnings';
import {
  EVIDENCE_TONE,
  decimalsOf,
  defaultItemOf,
  effectsAtFullRamp,
  numText,
  supEntryId,
  useSupplementText,
} from './text';

/** Does the draft differ from the stored entry? */
const changed = (a: SupplementEntry, b: SupplementEntry): boolean =>
  a.dose !== b.dose || a.schedule !== b.schedule || a.timing !== b.timing;

export function SupplementGroupSheet({
  group,
  onClose,
}: {
  group: SupplementGroup;
  onClose: () => void;
}) {
  const { t, groupName, itemName, itemShort, timingLabel, doseText, typicalText, fxValue } =
    useSupplementText();
  const { entries } = useSupplements();
  const items = itemsInGroup(group);
  // The saved state when the sheet opened: dirty is measured against it.
  const [saved] = useState(() => {
    const ids = new Set<string>(items.map((i) => i.id));
    return new Map(entries.filter((e) => e.active && ids.has(e.itemId)).map((e) => [e.itemId, e]));
  });
  const [focus, setFocus] = useState<SupplementId>(
    () => items.find((i) => saved.has(i.id))?.id ?? defaultItemOf(items),
  );
  const [drafts, setDrafts] = useState<Partial<Record<SupplementId, SupplementEntry>>>({});
  const [touched, setTouched] = useState<readonly SupplementId[]>([]);
  const [confirm, setConfirm] = useState(false);

  const draftOf = (id: SupplementId): SupplementEntry =>
    drafts[id] ?? saved.get(id) ?? newSupplementEntry(id, supEntryId(id));
  const draft = draftOf(focus);
  const item = supplementItem(focus);

  /** The items Save writes: the focused one, plus any other that was edited. */
  const toSave = items
    .map((i) => i.id)
    .filter((id) => {
      const s = saved.get(id);
      if (!s) return id === focus || touched.includes(id);
      return changed(draftOf(id), s);
    });
  const dirty = toSave.length > 0;

  const patch = (p: Partial<SupplementEntry>) => {
    setDrafts((d) => ({ ...d, [focus]: { ...draftOf(focus), ...p } }));
    setTouched((x) => (x.includes(focus) ? x : [...x, focus]));
  };
  const save = () => {
    if (!dirty) return;
    for (const id of toSave) saveSupplementEntry({ ...draftOf(id), active: true });
    onClose();
  };

  const doseOptions = item.presets.includes(draft.dose)
    ? [...item.presets]
    : [...item.presets, draft.dose].sort((a, b) => a - b);

  const fx = effectsAtFullRamp(draft);
  const fxKeys = fx ? SUPPLEMENT_EFFECT_KEYS.filter((k) => !isNeutralRange(fx[k])) : [];
  const caffeineMg = caffeineMgOf(draft);
  // Safety: this item's own flags, with the other saved items (and this draft) counted.
  const warnings = supplementWarnings(
    { entries: [...entries.filter((e) => e.itemId !== focus), { ...draft, active: true }] },
    supplementContext(),
  )
    .filter((w) => w.itemIds.includes(focus))
    // Name only this item, except where the combination is the point (the daily caffeine limit).
    .map((w) => (w.key === 'caffeineDailyLimit' ? w : { ...w, itemIds: [focus] }));

  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone="accent" size={40} icon={GROUP_ICONS[group]} />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-lg ut-w7">{groupName(group)}</span>
            <span className="ut-sm ut-muted">{t.supGroupBlurb[group]}</span>
          </div>
        </div>
        <div className="ul-flex ul-col ug-4">
          <Segmented
            label={t.supSheetSchedule}
            variant="track"
            value={draft.schedule}
            onChange={(schedule) => patch({ schedule })}
            options={[
              { value: 'daily', label: t.supSchedule.daily },
              { value: 'trainingDays', label: t.supSchedule.trainingDays },
            ]}
          />
          <span className="ut-sm ut-muted">{t.supSheetScheduleHelp}</span>
        </div>
        <div>
          <SectionLabel>{t.supSheetItem}</SectionLabel>
          <PresetChips
            label={t.supSheetItem}
            items={items.map((i) => ({
              id: i.id,
              label: (
                <>
                  {saved.has(i.id) && (
                    <>
                      <Icon name="check" />
                      <span className="visually-hidden">{t.supSaved}</span>
                    </>
                  )}
                  {itemShort(i.id)}
                </>
              ),
              selected: i.id === focus,
              onClick: () => setFocus(i.id),
            }))}
          />
        </div>
        <div className="ul-flex ul-col ug-4">
          <div className="ul-flex ua-center ug-8">
            <span className="ut-base ut-w6 uf-1">{itemName(focus)}</span>
            <Tag tone={EVIDENCE_TONE[item.evidence]}>{t.supEvidence[item.evidence]}</Tag>
          </div>
          <span className="ut-sm ut-muted">{t.supItemBlurb[focus]}</span>
        </div>
        <div>
          <SectionLabel>{t.supServing}</SectionLabel>
          <PresetChips
            label={t.supServing}
            items={doseOptions.map((d) => ({
              id: String(d),
              label: doseText(d, item.unit),
              selected: d === draft.dose,
              onClick: () => patch({ dose: d }),
            }))}
          />
        </div>
        <NumberStepper
          key={focus}
          label={t.supExact}
          value={draft.dose}
          onChange={(v) => patch({ dose: clampDose(item, v) })}
          step={item.step}
          decimals={decimalsOf(item)}
          min={item.minDose}
          max={item.maxDose}
          unit={t.supUnit[item.unit]}
        />
        <div>
          <SectionLabel>{t.supTimingLabel}</SectionLabel>
          <PresetChips
            label={t.supTimingLabel}
            items={TIMINGS.map((k) => ({
              id: k,
              label: timingLabel(k),
              selected: k === draft.timing,
              onClick: () => patch({ timing: k }),
            }))}
          />
        </div>
        <GroupedList
          surface="raised"
          footer={item.effect === 'protein' ? t.supProteinNote : undefined}
          notes={item.effect !== 'none' ? [t.supDisclaimer] : undefined}
        >
          <ListRow label={t.supTypical} value={typicalText(item)} />
          {caffeineMg > 0 && (
            <ListRow label={t.supCaffeineIn} value={`${numText(caffeineMg)} mg`} />
          )}
          {fx && fxKeys.length > 0 ? (
            fxKeys.map((k) => (
              <ListRow key={k} label={t.supFx[k]} value={fxValue(k, fx[k])} valueStrong />
            ))
          ) : (
            <ListRow
              label={t.supInNumbers}
              sub={item.effect === 'none' ? t.supNoEffect : t.supNoEffectHere}
            />
          )}
        </GroupedList>
        <SupplementWarnings warnings={warnings} />
        <Button variant="primary" fullWidth disabled={!dirty} onClick={save}>
          {t.nicSave}
        </Button>
        {saved.has(focus) && (
          <GroupedList surface="raised">
            <ListRow action tone="danger" label={t.supRemove} onClick={() => setConfirm(true)} />
          </GroupedList>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={t.supRemoveAsk}
          body={t.supRemoveBody(itemName(focus))}
          confirmLabel={t.nicRemoveConfirm}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            removeSupplementEntry(saved.get(focus)?.id ?? supEntryId(focus));
            setConfirm(false);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
