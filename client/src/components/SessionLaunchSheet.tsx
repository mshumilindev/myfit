/**
 * Session launch chooser — the entry point when you start a session. Three ways
 * in: build from your program's day (only when the program prescribes exercises
 * today), start from scratch, or let the builder auto-build a full day.
 */
import { Icon, Sheet } from '../ui';
import { useT } from '../i18n';

export function SessionLaunchSheet({
  onClose,
  goalLabel,
  programSub,
  onProgram,
  onScratch,
  onAuto,
}: {
  onClose: () => void;
  goalLabel?: string | null;
  /** Non-null shows the "from my program" option (e.g. "Push · 5 exercises"). */
  programSub?: string | null;
  onProgram?: () => void;
  onScratch: () => void;
  onAuto: () => void;
}) {
  const { t } = useT();
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet onClose={onClose}>
      <div className="sbl-head">
        <span className="t">{t.sbLaunchTitle}</span>
      </div>
      <div className="sbl-list">
        <button className="sbl-opt accent" onClick={act(onAuto)}>
          <span className="sbl-ic">
            <Icon name="robot" weight="fill" />
          </span>
          <span className="sbl-txt">
            <b>{t.sbAutoBuild}</b>
            <span>{t.sbAutoBuildSub}</span>
          </span>
          <Icon name="caret-right" className="sbl-go" />
        </button>
        {programSub && onProgram && (
          <button className="sbl-opt" onClick={act(onProgram)}>
            <span className="sbl-ic">
              <Icon name="calendar-check" />
            </span>
            <span className="sbl-txt">
              <b>{t.sbFromProgram}</b>
              <span>{programSub}</span>
            </span>
            <Icon name="caret-right" className="sbl-go" />
          </button>
        )}
        <button className="sbl-opt" onClick={act(onScratch)}>
          <span className="sbl-ic">
            <Icon name="list-plus" />
          </span>
          <span className="sbl-txt">
            <b>{t.sbFromScratch}</b>
            <span>{t.sbFromScratchSub}</span>
          </span>
          <Icon name="caret-right" className="sbl-go" />
        </button>
      </div>
      {goalLabel && (
        <div className="sbl-goal">
          <Icon name="target" />
          <span>{goalLabel}</span>
        </div>
      )}
    </Sheet>
  );
}
