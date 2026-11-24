/**
 * The cycle part of the program editor (Periodization chunk): the wrapper that shows one week of the program at a time,
 * the bar with the cycle switch and its weeks, and the load / reps fields of an exercise row. The tool itself knows none of it;
 * these arrive through `host.slots` only while the module is installed.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CycleStrip } from '../../components/ui/CycleStrip';
import { LoadField } from '../../components/ui/LoadField';
import { NumberStepper } from '../../components/ui/NumberStepper';
import { ConfirmDialog } from '../../components/ui/Overlays';
import { RepRange } from '../../components/ui/RepRange';
import { Segmented } from '../../components/ui/Segmented';
import { Switch } from '../../components/ui/Switch';
import { useT } from '../../i18n';
import type {
  EditorActions,
  EditorState,
  RowSlotProps,
  WrapProps,
} from '../../tools/programEditor/host';
import type { CycleLabel } from '../../views/programs/model';
import { CYCLE_LABELS, MAX_CYCLE, MIN_CYCLE, loadKg } from '../cycle';
import { fill } from '../strings';
import { maxFor } from '../maxes';
import {
  copyWeek,
  cutWeeksWithRows,
  disableCycle,
  enableCycle,
  labelOfWeek,
  mergeWeek,
  resizeCycle,
  setWeekLabel,
  weekView,
  type CycleDoc,
} from './cycleOps';
import { EDITOR_STRINGS } from './editorStrings';

interface Ctx {
  /** The whole document (every week). */
  full: CycleDoc;
  /** The week being edited (1-based). */
  week: number;
  setWeek: (n: number) => void;
  /** Replace the whole document (cycle on / off, resize, hints, copy). */
  setFull: (next: CycleDoc, label: string) => void;
  readOnly: boolean;
}
const CycleCtx = createContext<Ctx | null>(null);

/** Shows one week of the document as a plain program and puts every edit of it back into the whole. */
export function CycleWrap({ doc, onChange, readOnly, children }: WrapProps) {
  const full = doc as CycleDoc;
  const [picked, setPicked] = useState(1);
  const week = Math.min(picked, full.cycle?.length ?? 1);
  // The editor keeps its undo history against the identity of the document it was handed, so the view it gets back after an
  // edit must be the very object it produced. Keep the last (whole, week, view) triple in state and rebuild it only when the
  // whole document or the week changed from outside.
  const [pair, setPair] = useState<{ full: CycleDoc; week: number; view: CycleDoc }>(() => ({
    full,
    week,
    view: weekView(full, week),
  }));
  let view = pair.view;
  if (pair.full !== full || pair.week !== week) {
    view = weekView(full, week);
    setPair({ full, week, view });
  }
  const onView = useCallback<WrapProps['onChange']>(
    (next, meta) => {
      const merged = mergeWeek(full, week, next as CycleDoc);
      setPair({ full: merged, week, view: next as CycleDoc });
      onChange(merged, meta);
    },
    [full, week, onChange],
  );
  const setFull = useCallback(
    (next: CycleDoc, label: string) => onChange(next, { kind: 'edit', label }),
    [onChange],
  );
  const ctx = useMemo<Ctx>(
    () => ({ full, week, setWeek: setPicked, setFull, readOnly }),
    [full, week, setFull, readOnly],
  );
  return <CycleCtx.Provider value={ctx}>{children(view, onView)}</CycleCtx.Provider>;
}

type Ask =
  | { kind: 'off' }
  | { kind: 'cut'; length: number; weeks: number[] }
  | { kind: 'copy'; from: number; to: number };

/** The bar above the days: the switch, and (when on) the length, the weeks, the week's type and "copy from". */
export function WeekBar(_props: { state: EditorState; actions: EditorActions }) {
  void _props;
  const ctx = useContext(CycleCtx);
  const { locale } = useT();
  const s = EDITOR_STRINGS[locale];
  const [ask, setAsk] = useState<Ask | null>(null);
  if (!ctx) return null;
  const { full, week, setWeek, setFull, readOnly } = ctx;
  const cycle = full.cycle;
  const tagOf = (l: CycleLabel | undefined, n: number): string =>
    l ? s[l] : n === 1 ? s.base : s.none;
  return (
    <section className="pd-bar" aria-label={s.cycleSwitch}>
      <div className="pd-bar-head">
        <div>
          <b>{s.cycleSwitch}</b>
          <p className="ut-xs ut-faint">{s.cycleSub}</p>
        </div>
        <Switch
          checked={!!cycle}
          disabled={readOnly}
          aria-label={s.cycleSwitch}
          onChange={(on) => {
            if (on) setFull(enableCycle(full), s.cycleSwitch);
            else if (cycle && cycle.weeks.some((w) => w.items.length > 0)) setAsk({ kind: 'off' });
            else setFull(disableCycle(full), s.cycleSwitch);
          }}
        />
      </div>
      {cycle && (
        <>
          <NumberStepper
            label={s.length}
            value={cycle.length}
            min={MIN_CYCLE}
            max={MAX_CYCLE}
            unit={s.weeks.toLowerCase()}
            disabled={readOnly}
            onChange={(n) => {
              const cut = cutWeeksWithRows(full, n);
              if (cut.length) setAsk({ kind: 'cut', length: n, weeks: cut });
              else setFull(resizeCycle(full, n), s.length);
            }}
          />
          <CycleStrip
            label={s.weeks}
            value={week}
            onPick={setWeek}
            weeks={Array.from({ length: cycle.length }, (_x, i) => {
              const n = i + 1;
              const l = labelOfWeek(full, n);
              return {
                n,
                title: fill(s.weekN, { n }),
                tag: tagOf(l, n),
                tone:
                  l === 'deload'
                    ? 'rest'
                    : l === 'test'
                      ? 'accent'
                      : l === 'peak'
                        ? 'illness'
                        : 'neutral',
              };
            })}
          />
          <Segmented
            label={s.weekType}
            value={labelOfWeek(full, week) ?? 'none'}
            onChange={(v) =>
              setFull(setWeekLabel(full, week, v === 'none' ? undefined : v), s.weekType)
            }
            options={[
              { value: 'none', label: s.none },
              ...CYCLE_LABELS.map((l) => ({ value: l, label: s[l] })),
            ]}
          />
          {!readOnly && cycle.length > 1 && (
            <Segmented
              label={s.copyFrom}
              value={null}
              onChange={(from) => setAsk({ kind: 'copy', from: Number(from), to: week })}
              options={Array.from({ length: cycle.length }, (_x, i) => i + 1)
                .filter((n) => n !== week)
                .map((n) => ({ value: String(n), label: fill(s.weekN, { n }) }))}
            />
          )}
          <p className="ut-xs ut-faint">{s.same}</p>
        </>
      )}
      {ask?.kind === 'off' && (
        <ConfirmDialog
          danger
          title={s.offTitle}
          body={s.offBody}
          confirmLabel={s.offDo}
          cancelLabel={s.cancel}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setWeek(1);
            setFull(disableCycle(full), s.cycleSwitch);
            setAsk(null);
          }}
        />
      )}
      {ask?.kind === 'cut' && (
        <ConfirmDialog
          danger
          title={s.cutTitle}
          body={fill(s.cutBody, { weeks: ask.weeks.join(', ') })}
          confirmLabel={s.cutDo}
          cancelLabel={s.cancel}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setFull(resizeCycle(full, ask.length), s.length);
            setAsk(null);
          }}
        />
      )}
      {ask?.kind === 'copy' && (
        <ConfirmDialog
          title={fill(s.copyTitle, { from: ask.from, to: ask.to })}
          body={fill(s.copyBody, { from: ask.from, to: ask.to })}
          confirmLabel={s.copyDo}
          cancelLabel={s.cancel}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setFull(copyWeek(full, ask.from, ask.to), s.copyFrom);
            setAsk(null);
          }}
        />
      )}
    </section>
  );
}

/** The "Target weight" block of a row: kilograms, or a percent of the person's max with what it comes to. */
export function RowLoad({ item, patch, readOnly }: RowSlotProps) {
  const { locale } = useT();
  const s = EDITOR_STRINGS[locale];
  const mode = item.targetPct ? 'pct' : 'kg';
  const max = mode === 'pct' ? maxFor(item.name) : null;
  const l = loadKg({ targetWeight: item.targetWeight, targetPct: item.targetPct }, max);
  const hint =
    mode !== 'pct'
      ? undefined
      : l.kg !== null && max !== null
        ? fill(s.hintMax, { max, kg: l.kg })
        : s.hintNoMax;
  return (
    <LoadField
      mode={mode}
      onMode={(m) =>
        patch(
          m === 'pct'
            ? { targetPct: item.targetPct ?? 70, targetWeight: undefined }
            : { targetWeight: item.targetWeight ?? 40, targetPct: undefined },
        )
      }
      kg={item.targetWeight ?? 40}
      onKg={(n) => patch({ targetWeight: n || undefined })}
      pct={item.targetPct ?? 70}
      onPct={(n) => patch({ targetPct: n })}
      hint={hint}
      hintWarn={mode === 'pct' && l.kg === null}
      disabled={readOnly}
      labels={{
        type: s.loadType,
        kg: s.kg,
        pct: s.pct,
        weight: s.weight,
        percent: s.percent,
        unitKg: s.kg,
        unitPct: '%',
      }}
    />
  );
}

/** The Reps field of a row: one number, or from–to. */
export function RowReps({ item, patch }: RowSlotProps) {
  const { locale } = useT();
  const s = EDITOR_STRINGS[locale];
  return (
    <RepRange
      reps={item.reps}
      repsMin={item.repsMin}
      onChange={(n) => patch({ reps: n.reps, repsMin: n.repsMin })}
      labels={{ reps: s.reps, from: s.from, to: s.to, useRange: s.useRange, useOne: s.useOne }}
    />
  );
}
