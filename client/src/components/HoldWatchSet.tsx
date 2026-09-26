/**
 * Stopwatch set card for hold / time moves (home sets — a stomach vacuum, a
 * plank). There's no target: a hold lasts as long as it lasts, so the card is a
 * plain stopwatch — Start hold, then Release logs the time as one bodyweight
 * static-dynamic set. The running start is kept in localStorage per exercise so
 * a screen lock or a hop to another screen doesn't lose it.
 */
import { useEffect, useState } from 'react';
import type { Exercise } from '../types';
import { useT } from '../i18n';
import { Icon } from '../ui';

const KEY = (exId: string) => `spotter.hold.${exId}`;

function readStart(exId: string): number | null {
  try {
    const v = Number(localStorage.getItem(KEY(exId)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
function writeStart(exId: string, at: number | null): void {
  try {
    if (at === null) localStorage.removeItem(KEY(exId));
    else localStorage.setItem(KEY(exId), String(at));
  } catch {
    /* private mode — the hold just won't survive a reload */
  }
}

export function fmtHoldClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function HoldWatchSet(props: {
  ex: Exercise;
  setNo: number;
  /** Last time this move was done (any session): values in seconds. */
  last: { values: number[]; hold: boolean } | null;
  onLog: (sec: number) => void;
  onSettings: () => void;
}) {
  const { t } = useT();
  const [startedAt, setStartedAt] = useState<number | null>(() => readStart(props.ex.id));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const iv = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(iv);
  }, [startedAt]);
  const sec = startedAt === null ? 0 : Math.max(0, (now - startedAt) / 1000);
  const whole = Math.floor(sec);
  const lastLine =
    props.last && props.last.hold && props.last.values.length
      ? t.homeLastHold(props.last.values.map((v) => `${v} s`).join(' · '))
      : null;

  const start = () => {
    const at = Date.now();
    writeStart(props.ex.id, at);
    setStartedAt(at);
    setNow(at);
  };
  const cancel = () => {
    writeStart(props.ex.id, null);
    setStartedAt(null);
  };
  const release = () => {
    const s = Math.max(1, Math.round((Date.now() - (startedAt ?? Date.now())) / 1000));
    writeStart(props.ex.id, null);
    setStartedAt(null);
    props.onLog(s);
  };

  return (
    <>
      {lastLine && startedAt === null && <div className="hold-last">{lastLine}</div>}
      <div className="gset kind-hold">
        <div className="gset-title">
          {startedAt === null ? t.enterThisSet : t.homeHolding(props.setNo)}
        </div>
        <div className={`hold-watch${startedAt === null ? ' idle' : ''}`}>
          <span className="hw-time">{fmtHoldClock(sec)}</span>
          <span className="hw-sub">{startedAt === null ? t.homeHoldIdle : t.homeHoldRunning}</span>
        </div>
        <div className="gset-actions">
          {startedAt === null ? (
            <button
              className="gset-cfg"
              aria-label={t.setOptions}
              title={t.setOptions}
              onClick={props.onSettings}
            >
              <Icon name="sliders-horizontal" />
            </button>
          ) : (
            <button
              className="gset-cfg"
              aria-label={t.homeHoldCancel}
              title={t.homeHoldCancel}
              onClick={cancel}
            >
              <Icon name="x" />
            </button>
          )}
          {startedAt === null ? (
            <button className="btn btn-primary gset-log" onClick={start}>
              <Icon name="play" weight="fill" />
              {t.homeStartHold}
            </button>
          ) : (
            <button className="btn btn-primary gset-log" onClick={release} disabled={whole < 1}>
              <Icon name="check" weight="bold" />
              {t.homeRelease(whole)}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
