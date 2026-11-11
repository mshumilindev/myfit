import { useState } from 'react';
import { Icon } from '../../ui';
import { Banner } from './Banner';
import { Button } from './Button';
import { CallRoundButton } from './CallRoundButton';
import { PresetChips } from './PresetChips';
import { toneClass, type Tone } from './tones';
import './ReminderAlert.css';

export type ReminderAlertState = 'ringing' | 'snoozed' | 'elsewhere' | 'unavailable';

const STATE_ICON: Record<ReminderAlertState, string> = {
  ringing: 'bell-ringing',
  snoozed: 'clock-countdown',
  elsewhere: 'check-circle',
  unavailable: 'bell',
};

export interface ReminderAlertProps {
  /** `screen` = the whole phone screen; `card` = a floating card over the app (desktop). */
  variant: 'screen' | 'card';
  state: ReminderAlertState;
  title: string;
  /** Glyph and colour of the thing that rings (only while ringing). */
  icon?: string;
  tone?: Tone;
  /** "Reminder · in 1 h" line above the title. */
  kind: string;
  /** Second line ("Today at 18:00"). */
  sub?: string;
  /** Snooze lengths in minutes (the first-after-default is preselected: the middle one). */
  snoozeMinutes?: number[];
  labels: {
    snooze: string;
    dismiss: string;
    close: string;
    /** "10 min". */
    minutes: (n: number) => string;
    /** Body of the "already dismissed" banner (elsewhere, screen only). */
    doneTitle?: string;
    doneBody?: string;
  };
  onSnooze?: (minutes: number) => void;
  onDismiss?: () => void;
  onClose?: () => void;
}

/**
 * The reminder that rings (kit group `Alert`, design SPO-555): whole screen on a phone, a card on desktop. Four states: ringing
 * (snooze + dismiss), snoozed, dismissed on another device, ringing unavailable. The sound and vibration are the caller's.
 */
export function ReminderAlert({
  variant,
  state,
  title,
  icon = 'bell-ringing',
  tone = 'accent',
  kind,
  sub,
  snoozeMinutes = [5, 10, 30],
  labels,
  onSnooze,
  onDismiss,
  onClose,
}: ReminderAlertProps) {
  const card = variant === 'card';
  const on = state === 'ringing';
  const [min, setMin] = useState(snoozeMinutes[Math.min(1, snoozeMinutes.length - 1)] ?? 10);
  const tint = on ? toneClass(tone) : toneClass(state === 'elsewhere' ? 'ok' : 'rest');
  return (
    <section className={`uira${card ? ' uira--card' : ''}`} role="alertdialog" aria-label={title}>
      <span className={`uicall-rings uira-rings ${on ? 'uicall-rings--on' : ''} ${tint}`}>
        {on && (
          <>
            <span className="uira-r" />
            <span className="uira-r uira-r--2" />
            <span className="uira-r uira-r--3" />
          </>
        )}
        <span className="uira-ic">
          <Icon name={on ? icon : STATE_ICON[state]} />
        </span>
      </span>
      <div className="uira-t">
        <span className="uira-k">
          <Icon name="clock-countdown" />
          {kind}
        </span>
        <b>{title}</b>
        {sub && <span className="ut-xs ut-faint">{sub}</span>}
      </div>
      {!card && on && (
        <div className="uira-snz">
          <span className="ut-xs ut-faint">{labels.snooze}</span>
          <PresetChips
            layout="wrap"
            label={labels.snooze}
            items={snoozeMinutes.map((n) => ({
              id: String(n),
              label: labels.minutes(n),
              selected: n === min,
              onClick: () => setMin(n),
            }))}
          />
        </div>
      )}
      {!card && state === 'elsewhere' && labels.doneTitle && (
        <Banner tone="ok" icon="check-circle" title={labels.doneTitle} body={labels.doneBody} />
      )}
      <div className="uira-act">
        {on ? (
          card ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon="clock-countdown"
                onClick={() => onSnooze?.(min)}
              >
                {labels.minutes(min)}
              </Button>
              <Button variant="danger" size="sm" icon="x" onClick={onDismiss}>
                {labels.dismiss}
              </Button>
            </>
          ) : (
            <>
              <CallRoundButton
                tone="neutral"
                size="lg"
                icon="clock-countdown"
                label={labels.snooze}
                onClick={() => onSnooze?.(min)}
              />
              <CallRoundButton
                tone="danger"
                size="lg"
                icon="x"
                label={labels.dismiss}
                onClick={onDismiss}
              />
            </>
          )
        ) : (
          <Button
            variant="secondary"
            size={card ? 'sm' : undefined}
            fullWidth={!card}
            onClick={onClose}
          >
            {labels.close}
          </Button>
        )}
      </div>
    </section>
  );
}
