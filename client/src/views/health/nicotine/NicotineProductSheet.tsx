/**
 * Nicotine product sheet (board 2B): the usual amount of one product. Unit toggle, "About
 * how much a day" stepper, strength in mg, the read-only mg a day, Save (disabled until
 * something changed) and Remove (behind a confirm). No counters, no logging. Kit only.
 */
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { ConfirmDialog, Sheet } from '../../../components/ui/Overlays';
import { Segmented } from '../../../components/ui/Segmented';
import {
  MAX_AMOUNT_PER_DAY,
  MAX_STRENGTH_MG,
  convertAmount,
  DEFAULT_ML_PER_POD,
  nicotineKindInfo,
  productMgPerDay,
  unitsFor,
} from '../../../nicotine';
import { removeNicotineProduct, saveNicotineProduct } from '../../../store';
import type { NicotineProduct, NicotineUnit } from '../../../types';
import { NIC_ICON, numText, roundMg, snapAmount, stepFor, useNicotineText } from './text';

/** Does the draft differ from the stored product? Amount, unit and pod size only matter daily. */
const changed = (a: NicotineProduct, b: NicotineProduct): boolean =>
  !!a.occasional !== !!b.occasional ||
  a.strengthMg !== b.strengthMg ||
  (!a.occasional &&
    (a.unit !== b.unit ||
      a.amount !== b.amount ||
      (a.mlPerPod ?? DEFAULT_ML_PER_POD) !== (b.mlPerPod ?? DEFAULT_ML_PER_POD)));

export function NicotineProductSheet({
  product,
  isNew,
  onClose,
}: {
  /** The saved product, or a suggested one (defaults) while `isNew`. The sheet edits a draft. */
  product: NicotineProduct;
  /** Not saved yet: Save is on from the start and there is nothing to remove. */
  isNew: boolean;
  onClose: () => void;
}) {
  const { t, kindLabel, unitLabel, cap } = useNicotineText();
  const [draft, setDraft] = useState<NicotineProduct>(product);
  const [strengthText, setStrengthText] = useState(() => numText(product.strengthMg));
  const [podText, setPodText] = useState(() => numText(product.mlPerPod ?? DEFAULT_ML_PER_POD));
  const [confirm, setConfirm] = useState(false);
  const info = nicotineKindInfo(product.kind);
  const units = unitsFor(product.kind);
  const occasional = !!draft.occasional;
  const dirty = isNew || changed(draft, product);
  const mg = roundMg(productMgPerDay(draft));
  const shape = stepFor(draft.unit);

  const setUnit = (unit: NicotineUnit) =>
    setDraft((d) => ({ ...d, unit, amount: snapAmount(convertAmount(d, unit), unit) }));
  const setStrength = (raw: string) => {
    setStrengthText(raw);
    const n = Number(raw.replace(',', '.'));
    if (raw.trim() !== '' && Number.isFinite(n))
      setDraft((d) => ({ ...d, strengthMg: Math.min(MAX_STRENGTH_MG, Math.max(0, n)) }));
  };
  const setPod = (raw: string) => {
    setPodText(raw);
    const n = Number(raw.replace(',', '.'));
    setDraft((d) => {
      const next = { ...d };
      if (raw.trim() !== '' && Number.isFinite(n) && n > 0)
        next.mlPerPod = Math.min(20, Math.max(0.1, n));
      else if (raw.trim() === '') delete next.mlPerPod;
      return next;
    });
  };
  /** The other mode's values stay in the draft, so toggling back and forth loses nothing. */
  const setOccasional = (on: boolean) =>
    setDraft((d) => {
      const next = { ...d };
      if (on) next.occasional = true;
      else delete next.occasional;
      return next;
    });
  const save = () => {
    if (!dirty) return;
    saveNicotineProduct({ ...draft, active: true });
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone="accent" size={40} icon={NIC_ICON[product.kind]} />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-lg ut-w7">{kindLabel(product.kind)}</span>
            <span className="ut-sm ut-muted">{t.nicKindHint[product.kind]}</span>
          </div>
        </div>
        <Segmented
          label={t.nicHowOften}
          variant="track"
          value={occasional ? 'some' : 'day'}
          onChange={(v) => setOccasional(v === 'some')}
          options={[
            { value: 'day', label: t.nicFreqDaily },
            { value: 'some', label: t.nicFreqSome },
          ]}
        />
        {!occasional && units.length > 1 && (
          <Segmented
            label={t.nicCountBy}
            variant="track"
            value={draft.unit}
            onChange={setUnit}
            options={units.map((u) => ({
              value: u,
              label: u === 'ml' ? unitLabel(u) : cap(unitLabel(u)), // "ml" stays lowercase
              compact: units.length > 3,
            }))}
          />
        )}
        {!occasional && (
          <NumberStepper
            label={t.nicAbout}
            value={draft.amount}
            onChange={(amount) => setDraft((d) => ({ ...d, amount }))}
            step={shape.step}
            decimals={shape.decimals}
            min={0}
            max={MAX_AMOUNT_PER_DAY}
            unit={unitLabel(draft.unit)}
          />
        )}
        {!occasional && product.kind === 'vape' && draft.unit === 'pods' && (
          <Field
            label={t.nicPodSize}
            inputMode="decimal"
            value={podText}
            onChange={(e) => setPod(e.target.value)}
            onBlur={() => setPodText(numText(draft.mlPerPod ?? DEFAULT_ML_PER_POD))}
            trail={t.nicPodTrail}
            hint={t.nicPodHint}
          />
        )}
        <Field
          label={t.nicStrength}
          inputMode="decimal"
          value={strengthText}
          onChange={(e) => setStrength(e.target.value)}
          onBlur={() => setStrengthText(numText(draft.strengthMg))}
          trail={t.nicPer[info.strengthPer]}
        />
        {occasional && <span className="ut-sm ut-muted">{t.nicOccasionalHelp}</span>}
        <GroupedList surface="raised">
          <ListRow label={t.nicFromThis} value={`≈ ${t.nicMgADay(mg)}`} />
        </GroupedList>
        <Button variant="primary" fullWidth disabled={!dirty} onClick={save}>
          {t.nicSave}
        </Button>
        {!isNew && (
          <GroupedList surface="raised">
            <ListRow action tone="danger" label={t.nicRemove} onClick={() => setConfirm(true)} />
          </GroupedList>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={t.nicRemoveAsk}
          body={t.nicRemoveBody}
          confirmLabel={t.nicRemoveConfirm}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            removeNicotineProduct(product.id);
            setConfirm(false);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
