/**
 * The safety Notices of the supplements pages: one per flag of `supplementWarnings`, worst
 * first, each naming the supplements behind it. Shown on the hub (all saved supplements) and
 * in the item sheet (the focused one). Kit Notice only.
 */
import { Notice } from '../../../components/ui/Notice';
import type { SupplementWarning } from '../../../supplements';
import { WARNING_TONE, useSupplementText } from './text';

export function SupplementWarnings({ warnings }: { warnings: readonly SupplementWarning[] }) {
  const { t, itemShort } = useSupplementText();
  if (warnings.length === 0) return null;
  return (
    <div className="ul-flex ul-col ug-8" role="group" aria-label={t.supWarnHead}>
      {warnings.map((w) => (
        <Notice key={w.key} tone={WARNING_TONE[w.level].tone} icon={WARNING_TONE[w.level].icon}>
          {t.supWarn[w.key](w.itemIds.map(itemShort).join(', '))}
        </Notice>
      ))}
    </div>
  );
}
