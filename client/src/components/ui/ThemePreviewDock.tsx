import { Button } from './Button';
import { Card } from './Card';
import { Tag } from './Tag';
import './ThemePreviewDock.css';

export interface ThemePreviewDockProps {
  /** Brand name of the theme being previewed (not translated). */
  themeName: string;
  /** Word on the "New" tag, e.g. "New". */
  newLabel: string;
  /** One line under the name: nothing is saved until the user confirms. */
  hint: string;
  /** Accessible name of the whole dock. */
  label: string;
  keepLabel: string;
  useLabel: string;
  onKeep: () => void;
  onUse: () => void;
}

/**
 * The bar shown while a new theme is being tried (SPO-355): the app behind it already wears the theme and
 * the bar itself is drawn in that theme (it lives in the same document, so it follows `<html data-theme>`).
 * It is NOT a modal: no scrim, no focus trap, the screen stays usable; it only goes away through
 * "Keep current" or "Use". Full width at the bottom on a phone, a 560px bar centred at the bottom on desktop.
 */
export function ThemePreviewDock({
  themeName,
  newLabel,
  hint,
  label,
  keepLabel,
  useLabel,
  onKeep,
  onUse,
}: ThemePreviewDockProps) {
  return (
    <section className="uidock" role="region" aria-label={label}>
      <Card emphasis="glass" pad="md" className="uidock-card">
        <div className="uidock-head">
          <span className="uidock-name">{themeName}</span>
          <Tag tone="accent">{newLabel}</Tag>
        </div>
        <p className="uidock-hint">{hint}</p>
        <div className="uidock-actions">
          <Button variant="secondary" fullWidth onClick={onKeep}>
            {keepLabel}
          </Button>
          <Button variant="primary" fullWidth onClick={onUse}>
            {useLabel}
          </Button>
        </div>
      </Card>
    </section>
  );
}
