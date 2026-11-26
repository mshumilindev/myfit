import { BlockCountdown } from '../components/ui/BlockCountdown';
import { Tag } from '../components/ui/Tag';
import { Icon } from '../ui';
import { useT } from '../i18n';
import { COUNTDOWN_FROM, WARN_AT, type CuePrefs } from './cues';
import type { BlockSpec } from './model';
import { specTitle } from './specText';
import { STRINGS } from './strings';
import { useCountdown } from './useCountdown';

const FMT_ICON = {
  amrap: 'arrow-clockwise',
  emom: 'timer',
  fortime: 'flag-checkered',
  intervals: 'lightning',
} as const;

export interface BlockCountdownRunProps {
  spec: BlockSpec;
  prefs: CuePrefs;
  /** GO reached: start the block clock here. */
  onStart: () => void;
  /** The overlay may go away (after the GO beat, or on Cancel). */
  onClose: () => void;
  /** Cancel before GO: back to the ready block, nothing started. */
  onCancel: () => void;
}

/** The get-ready overlay of a block: 5-4-3-2-1 with sound and vibration, GO starts the clock; tap skips, Cancel backs out. */
export function BlockCountdownRun({
  spec,
  prefs,
  onStart,
  onClose,
  onCancel,
}: BlockCountdownRunProps) {
  const t = STRINGS[useT().locale];
  const { n, go, skip } = useCountdown({ prefs, onStart, onClose });
  return (
    <BlockCountdown
      n={n}
      total={COUNTDOWN_FROM}
      warnAt={WARN_AT}
      go={go}
      tag={
        <Tag tone="conditioning" icon={<Icon name={FMT_ICON[spec.fmt]} />}>
          {t.formats[spec.fmt]}
        </Tag>
      }
      title={specTitle(spec)}
      goLabel={t.go}
      hint={go ? t.clockRunning : t.getInPosition}
      cancelLabel={t.cancel}
      ariaLabel={t.getReady}
      onCancel={onCancel}
      onSkip={go ? undefined : skip}
    />
  );
}
