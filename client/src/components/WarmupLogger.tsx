/**
 * WarmupLogger — the standard exercise logger, cut down for a warm-up exercise:
 * the exercise (photo + name) heads a warm-up-styled card, then the steppers
 * (reps + weight for loaded moves, reps for bodyweight / bands, seconds for
 * timed ones) and ONE action button. Nothing is recorded until it is pressed:
 * no set types, RPE, failure, rest or notes. Used pending in the session's
 * warm-up (action "Log") and inside the Edit drawer (action "Save").
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { exerciseImage } from '../data/exercises';
import { kgToLb, lbToKg } from '../plates';
import { exerciseUnit } from '../store';
import { useExerciseName } from '../ui';
import type { WarmupValues } from '../warmupLog';
import { Button, IconButton } from './ui/Button';
import { ConfirmDialog } from './ui/Overlays';
import { Card } from './ui/Card';
import { NumberStepper } from './ui/NumberStepper';
import './WarmupCard.css';

export function WarmupLogger(props: {
  /** Canonical exercise name. */
  name: string;
  /** Logged in seconds (otherwise reps). */
  timed: boolean;
  /** Takes a weight (loaded equipment). */
  weighted: boolean;
  /** Pre-filled values — nothing is recorded until the action is pressed. */
  initial: WarmupValues;
  /** The one action: "Log" for a pending exercise, "Save" in the drawer. */
  actionLabel: string;
  onSubmit: (values: WarmupValues) => void;
  /** Remove the exercise from the warm-up. */
  onRemove?: () => void;
  /** Remove as a labelled button next to the action (drawer) instead of the x. */
  removeAsButton?: boolean;
  /** Ask before removing (a logged exercise); a program target is removed at once. */
  confirmBeforeRemove?: boolean;
  /** Action stays disabled until a value differs from `initial` (the drawer's Save). */
  requireChange?: boolean;
  /** No card chrome (inside a drawer). */
  plain?: boolean;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  const unit = exerciseUnit(props.name);
  const [reps, setReps] = useState(Math.max(0, props.initial.reps ?? 12));
  const [sec, setSec] = useState(Math.max(0, props.initial.durationSec ?? 30));
  const [kg, setKg] = useState(props.initial.weight ?? 0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const label = exName(props.name);
  const img = exerciseImage(props.name, 'strength');
  const toDisp = (v: number): number => (unit === 'lb' ? Math.round(kgToLb(v) * 10) / 10 : v);
  const fromDisp = (v: number): number => (unit === 'lb' ? Math.round(lbToKg(v) * 100) / 100 : v);

  // Save (drawer) stays disabled until a value differs from the logged one.
  const dirty = props.timed
    ? sec !== (props.initial.durationSec ?? 30)
    : reps !== Math.max(0, props.initial.reps ?? 12) ||
      (props.weighted && kg !== (props.initial.weight ?? 0));

  const submit = () =>
    props.onSubmit(props.timed ? { durationSec: sec } : { reps, weight: props.weighted ? kg : 0 });

  const body = (
    <>
      <div className="wu-log-head">
        {img && <img className="wu-thumb" src={img} alt="" />}
        <span className="wu-log-name">{label}</span>
        {props.onRemove && !props.removeAsButton && (
          <IconButton icon="x" label={t.wuRemoveItem} onClick={props.onRemove} />
        )}
      </div>
      <div className="gset-steppers">
        {props.timed ? (
          <NumberStepper
            label={t.holdSecLabel}
            value={sec}
            step={5}
            min={0}
            max={3600}
            onChange={setSec}
          />
        ) : (
          <>
            <NumberStepper
              label={t.reps}
              value={reps}
              step={1}
              min={0}
              max={999}
              onChange={setReps}
            />
            {props.weighted && (
              <NumberStepper
                label={unit === 'lb' ? t.weightLb : t.weightKg}
                value={toDisp(kg)}
                step={unit === 'lb' ? 5 : 2.5}
                min={0}
                decimals={unit === 'lb' ? 1 : 2}
                onChange={(x) => setKg(fromDisp(x))}
              />
            )}
          </>
        )}
      </div>
      <div className="gset-actions">
        {props.onRemove && props.removeAsButton && (
          <Button
            variant="danger"
            onClick={() =>
              props.confirmBeforeRemove ? setConfirmRemove(true) : props.onRemove?.()
            }
          >
            {t.wuRemoveItem}
          </Button>
        )}
        <Button
          variant="fill"
          className="gset-log"
          disabled={props.requireChange && !dirty}
          onClick={submit}
        >
          {props.actionLabel}
        </Button>
      </div>
    </>
  );

  const removeDialog = confirmRemove && (
    <ConfirmDialog
      title={t.deleteExerciseTitle(label)}
      body={t.wuRemoveBody}
      confirmLabel={t.delete}
      cancelLabel={t.keep}
      danger
      onConfirm={() => {
        setConfirmRemove(false);
        props.onRemove?.();
      }}
      onCancel={() => setConfirmRemove(false)}
    />
  );

  return props.plain ? (
    <div className="gset kind-warmup wu-log wu-log--plain" role="group" aria-label={label}>
      {body}
      {removeDialog}
    </div>
  ) : (
    <Card
      emphasis="hero"
      pad="md"
      className="gset kind-warmup wu-log"
      role="group"
      aria-label={label}
    >
      {body}
      {removeDialog}
    </Card>
  );
}
