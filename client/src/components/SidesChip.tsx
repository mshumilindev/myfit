/**
 * "×2" badge on a lift whose logged weight counts for both sides: a pair of
 * implements (weight is per hand) or one side at a time (log one side, the
 * other matches). Tap to change it (opens the lift's set options → Sides).
 */
import { useT } from '../i18n';
import { sidesMode } from '../store';
import type { Exercise } from '../types';
import { Chip } from './ui/Chip';

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
  const tone = mode === 'pair' ? 'accent' : 'rest';
  return (
    <Chip
      tone={tone}
      lead="×2"
      className="sides-chip"
      title={note}
      aria-label={onClick ? `${label} — ${note}` : undefined}
      onClick={onClick}
    >
      {label}
    </Chip>
  );
}
