/**
 * Programs ↔ Exercises top switcher (design AC-LIBTAB). Two peer tabs that swap
 * the page content in place — no overlay, no back button. Rendered inside the
 * `programs-top` bar by both ProgramsView and the framed Exercises tab so the
 * switcher stays put while the content below it changes.
 */
import { useT } from '../i18n';

export function ProgramsTabs({
  active,
  onSelect,
}: {
  active: 'programs' | 'exercises';
  onSelect: (exercises: boolean) => void;
}) {
  const { t } = useT();
  return (
    <div className="prog-tabs" role="tablist">
      <button
        role="tab"
        aria-selected={active === 'programs'}
        className={active === 'programs' ? 'active' : ''}
        onClick={() => onSelect(false)}
      >
        {t.programsTabLabel}
      </button>
      <button
        role="tab"
        aria-selected={active === 'exercises'}
        className={active === 'exercises' ? 'active' : ''}
        onClick={() => onSelect(true)}
      >
        {t.exercisesTabLabel}
      </button>
    </div>
  );
}
