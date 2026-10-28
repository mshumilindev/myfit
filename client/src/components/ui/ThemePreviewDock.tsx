import { Button, IconButton } from './Button';
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
  /** Accessible name and tooltip of the ✕ button (Keep current); it shows no text so long locales (pl) fit. */
  keepLabel: string;
  useLabel: string;
  onKeep: () => void;
  onUse: () => void;
}

/**
 * The bar shown while a new theme is being tried (SPO-355): the app behind it already wears the theme and
 * the bar itself is drawn in that theme (it lives in the same document, so it follows `<html data-theme>`).
 * It is NOT a modal: no scrim, no focus trap, the screen stays usable; it only goes away through
 * the ✕ (Keep current), Esc or "Use". Full width at the bottom on a phone, a 560px bar centred at the bottom on desktop.
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
          <IconButton
            icon="x"
            variant="secondary"
            label={keepLabel}
            title={keepLabel}
            onClick={onKeep}
          />
          <Button variant="primary" fullWidth onClick={onUse}>
            {useLabel}
          </Button>
        </div>
      </Card>
    </section>
  );
}
