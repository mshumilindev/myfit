import { useEffect, useRef } from 'react';
import { Icon } from '../../../ui';
import { useT } from '../../../i18n';
import { useSafeT } from '../../../i18n/coachSafe';
import { UNDO_MS } from '../../../coach/domain/signalConfig';
import { Button } from '../Button';
import { toneClass } from '../tones';
import { UndoToast } from '../UndoToast';

export interface SnackState {
  id?: number;
  text: string;
  onUndo: () => void;
}

/**
 * The app's undo snackbar. One implementation: the kit `UndoToast` (countdown bar, one window length for the whole
 * product, 8 s, decision 11) docked bottom-left. The caller commits when `onDone` fires.
 */
export function UndoSnackbar({
  snack,
  onDone,
  durationMs = UNDO_MS,
}: {
  snack: SnackState;
  onDone: () => void;
  durationMs?: number;
}) {
  const { t } = useT();
  const { sf } = useSafeT();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const to = setTimeout(() => done.current(), durationMs);
    return () => clearTimeout(to);
  }, [durationMs]);
  return (
    <UndoToast
      position="fixed"
      text={snack.text}
      undoLabel={t.undo}
      countdownLabel={sf.undoCountdown}
      durationMs={durationMs}
      onUndo={() => {
        snack.onUndo();
        done.current();
      }}
    />
  );
}

export interface ToastState {
  kind: 'ok' | 'danger';
  icon: string;
  text: string;
}

/** Auto-dismissing toast (3.2 s). Multiple stack bottom-right as a queue. */
export function Toast({
  toast,
  id,
  onExpire,
}: {
  toast: ToastState;
  id: number;
  onExpire: (id: number) => void;
}) {
  useEffect(() => {
    const to = setTimeout(() => onExpire(id), 3200);
    return () => clearTimeout(to);
  }, [id, onExpire]);
  return (
    <div className={`toast ${toast.kind} ${toneClass(toast.kind)}`}>
      <Icon name={toast.icon} />
      <span>{toast.text}</span>
    </div>
  );
}

/**
 * "New build is live" plate — persists (no auto-dismiss) until the user taps
 * Reload. Raised by the service-worker update signal (see pwaUpdate); the app
 * renders it in the toast holder when a replacement worker has taken control.
 */
export function UpdatePlate({
  onReload = () => window.location.reload(),
}: {
  /** Apply the update; the app passes a handler that first pulls the NEWEST build (see pwaUpdate.reloadToLatest). */
  onReload?: () => void;
}) {
  const { t } = useT();
  return (
    <div className={`toast update ${toneClass('accent')}`} role="alert">
      <Icon name="arrows-clockwise" />
      <span className="update-text">{t.updateReady}</span>
      <Button variant="secondary" size="sm" onClick={onReload}>
        {t.reload}
      </Button>
    </div>
  );
}
