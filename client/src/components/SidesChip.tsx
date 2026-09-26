/**
 * "×2" badge on a lift whose logged weight counts for both sides: a pair of
 * implements (weight is per hand) or one side at a time (log one side, the
 * other matches). Tap to change it (opens the lift's set options → Sides).
 */
import { useT } from '../i18n';
import { sidesMode } from '../store';
import type { Exercise } from '../types';

export function SidesChip({
  ex,
  onClick,
}: {
  ex: Pick<Exercise, 'name' | 'equipment'>;
  onClick?: () => void;
}) {
  const { t } = useT();
  const mode = sidesMode(ex);
  if (mode === 'single') return null;
  const label = mode === 'pair' ? t.sidesPairLabel : t.sidesUniLabel;
  const note = mode === 'pair' ? t.perHandNote : t.sidesUniNote;
  const inner = (
    <>
      <b className="sc-x">×2</b>
      <span className="sc-l">{label}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`sides-chip mode-${mode}`}
      title={note}
      aria-label={`${label} — ${note}`}
      onClick={onClick}
    >
      {inner}
    </button>
  ) : (
    <span className={`sides-chip mode-${mode}`} title={note}>
      {inner}
    </span>
  );
}
